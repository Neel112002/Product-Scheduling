# controllers/analytics_controller.py
from flask              import jsonify, request
from flask_jwt_extended import get_jwt_identity
from models             import Employment, Shift, TimeEntry
from datetime           import datetime, timezone, timedelta
from collections        import defaultdict


class AnalyticsController:

    def _check_permission(self, manager_id: int):
        emp = Employment.query.filter_by(
            user_id=manager_id, status='active'
        ).first()
        if not emp or emp.role.name.lower() not in ('owner', 'manager', 'supervisor'):
            return None, jsonify({'error': 'Forbidden'}), 403
        return emp, None, None

    def get_analytics(self):
        manager_id  = int(get_jwt_identity())
        location_id = request.args.get('location_id', type=int)
        period      = request.args.get('period', 'week')   # day | week | month
        start_date  = request.args.get('start_date')       # YYYY-MM-DD optional

        if not location_id:
            return jsonify({'error': 'location_id required'}), 400

        emp, err_resp, err_code = self._check_permission(manager_id)
        if err_resp:
            return err_resp, err_code

        now = datetime.now(timezone.utc)

        # ── Compute date range ────────────────────────────────────────────────
        if start_date:
            try:
                anchor = datetime.strptime(start_date, '%Y-%m-%d').replace(
                    tzinfo=timezone.utc
                )
            except ValueError:
                anchor = now
        else:
            anchor = now

        if period == 'day':
            start = anchor.replace(hour=0, minute=0, second=0, microsecond=0)
            end   = start + timedelta(days=1)

        elif period == 'week':
            dow   = anchor.weekday()
            start = (anchor - timedelta(days=dow)).replace(
                hour=0, minute=0, second=0, microsecond=0
            )
            end   = start + timedelta(days=7)

        else:  # month
            start = anchor.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            if start.month == 12:
                end = start.replace(year=start.year + 1, month=1)
            else:
                end = start.replace(month=start.month + 1)

        # ── Active employees ──────────────────────────────────────────────────
        emps        = Employment.query.filter_by(
            location_id=location_id, status='active'
        ).all()
        emp_user_ids = [e.user_id for e in emps]
        emp_map      = {e.user_id: e for e in emps}

        # ── Scheduled shifts ──────────────────────────────────────────────────
        shifts = Shift.query.filter(
            Shift.location_id == location_id,
            Shift.status      == 'published',
            Shift.start_time  >= start,
            Shift.start_time  <  end,
        ).all()

        scheduled_hours = sum(
            (s.end_time - s.start_time).total_seconds() / 3600 -
            (s.break_minutes or 0) / 60
            for s in shifts
        )

        # ── Time entries ──────────────────────────────────────────────────────
        entries = TimeEntry.query.filter(
            TimeEntry.user_id.in_(emp_user_ids),
            TimeEntry.clock_in  >= start,
            TimeEntry.clock_in  <  end,
            TimeEntry.clock_out != None,
        ).all()

        worked_hours = sum((e.total_minutes or 0) / 60 for e in entries)

        # ── Labor cost ────────────────────────────────────────────────────────
        total_cost = 0.0
        for entry in entries:
            emp_r  = emp_map.get(entry.user_id)
            rate   = float(emp_r.hourly_rate) if (emp_r and emp_r.hourly_rate) else 0.0
            total_cost += (entry.total_minutes or 0) / 60 * rate

        # ── Coverage % ────────────────────────────────────────────────────────
        coverage_pct = round(
            (worked_hours / scheduled_hours * 100) if scheduled_hours > 0 else 0, 1
        )

        # ── Late clock-ins ────────────────────────────────────────────────────
        late_list  = []
        late_count = 0
        for entry in entries:
            if not entry.shift_id:
                continue
            shift = next((s for s in shifts if s.shift_id == entry.shift_id), None)
            if not shift:
                continue
            s_start  = shift.start_time
            if s_start.tzinfo is None:
                s_start = s_start.replace(tzinfo=timezone.utc)
            c_in = entry.clock_in
            if c_in.tzinfo is None:
                c_in = c_in.replace(tzinfo=timezone.utc)

            mins_late = (c_in - s_start).total_seconds() / 60
            if mins_late > 5:
                late_count += 1
                from models import AppUser
                user = AppUser.query.get(entry.user_id)
                late_list.append({
                    'name':      user.display_name or user.username if user else 'Unknown',
                    'date':      shift.start_time.strftime('%b %d'),
                    'mins_late': int(mins_late),
                })

        # ── Overtime ──────────────────────────────────────────────────────────
        overtime_hours = sum(
            max((e.total_minutes or 0) / 60 - 8, 0) for e in entries
        )

        # ── Hours per day (for week/month bar chart) ──────────────────────────
        daily_worked = defaultdict(float)
        for entry in entries:
            key = entry.clock_in.strftime('%Y-%m-%d')
            daily_worked[key] += (entry.total_minutes or 0) / 60

        hours_per_day = []
        current = start
        while current < end:
            key = current.strftime('%Y-%m-%d')
            hours_per_day.append({
                'date':   key,
                'day':    current.strftime('%a'),
                'dayNum': current.strftime('%d'),
                'worked': round(daily_worked.get(key, 0), 1),
            })
            current += timedelta(days=1)

        # ── Hours per employee (for day bar chart) ────────────────────────────
        emp_hours: dict[int, float] = defaultdict(float)
        for entry in entries:
            emp_hours[entry.user_id] += (entry.total_minutes or 0) / 60

        hours_per_employee = []
        for uid, hrs in emp_hours.items():
            emp_r = emp_map.get(uid)
            if not emp_r:
                continue
            from models import AppUser
            user = AppUser.query.get(uid)
            name = (user.display_name or user.username) if user else 'Unknown'
            hours_per_employee.append({
                'name':  name[:10],  # truncate for chart label
                'hours': round(hrs, 1),
                'role':  emp_r.role.name if emp_r.role else 'Staff',
            })
        hours_per_employee.sort(key=lambda x: x['hours'], reverse=True)

        # ── Trend data ────────────────────────────────────────────────────────
        trend_data = []

        if period in ('day', 'week'):
            # Last 4 weeks
            for i in range(3, -1, -1):
                w_start = (now - timedelta(weeks=i)).replace(
                    hour=0, minute=0, second=0, microsecond=0
                )
                w_start -= timedelta(days=w_start.weekday())
                w_end    = w_start + timedelta(days=7)

                w_entries = TimeEntry.query.filter(
                    TimeEntry.user_id.in_(emp_user_ids),
                    TimeEntry.clock_in  >= w_start,
                    TimeEntry.clock_in  <  w_end,
                    TimeEntry.clock_out != None,
                ).all()

                w_hours = sum((e.total_minutes or 0) / 60 for e in w_entries)
                w_cost  = 0.0
                for e in w_entries:
                    r    = emp_map.get(e.user_id)
                    rate = float(r.hourly_rate) if (r and r.hourly_rate) else 0.0
                    w_cost += (e.total_minutes or 0) / 60 * rate

                trend_data.append({
                    'label': w_start.strftime('%b %d'),
                    'hours': round(w_hours, 1),
                    'cost':  round(w_cost, 2),
                })
        else:
            # Last 4 months
            for i in range(3, -1, -1):
                m  = (now.month - i - 1) % 12 + 1
                yr = now.year if now.month - i > 0 else now.year - 1
                try:
                    m_start = datetime(yr, m, 1, tzinfo=timezone.utc)
                    if m == 12:
                        m_end = datetime(yr + 1, 1, 1, tzinfo=timezone.utc)
                    else:
                        m_end = datetime(yr, m + 1, 1, tzinfo=timezone.utc)
                except ValueError:
                    continue

                m_entries = TimeEntry.query.filter(
                    TimeEntry.user_id.in_(emp_user_ids),
                    TimeEntry.clock_in  >= m_start,
                    TimeEntry.clock_in  <  m_end,
                    TimeEntry.clock_out != None,
                ).all()

                m_hours = sum((e.total_minutes or 0) / 60 for e in m_entries)
                m_cost  = 0.0
                for e in m_entries:
                    r    = emp_map.get(e.user_id)
                    rate = float(r.hourly_rate) if (r and r.hourly_rate) else 0.0
                    m_cost += (e.total_minutes or 0) / 60 * rate

                trend_data.append({
                    'label': m_start.strftime('%b'),
                    'hours': round(m_hours, 1),
                    'cost':  round(m_cost, 2),
                })

        # ── Hours by role ─────────────────────────────────────────────────────
        role_hours: dict[str, float] = defaultdict(float)
        for entry in entries:
            emp_r     = emp_map.get(entry.user_id)
            role_name = emp_r.role.name if (emp_r and emp_r.role) else 'Staff'
            role_hours[role_name] += (entry.total_minutes or 0) / 60

        total_rh     = sum(role_hours.values()) or 1
        hours_by_role = [
            {
                'role':  role,
                'hours': round(hrs, 1),
                'pct':   round(hrs / total_rh * 100, 1),
            }
            for role, hrs in role_hours.items()
        ]

        # ── Date range labels ─────────────────────────────────────────────────
        if period == 'day':
            date_label = start.strftime('%a, %b %d %Y')
        elif period == 'week':
            date_label = f"{start.strftime('%b %d')} – {(end - timedelta(days=1)).strftime('%b %d, %Y')}"
        else:
            date_label = start.strftime('%B %Y')

        return jsonify({
            'period':               period,
            'start':                start.strftime('%Y-%m-%d'),
            'end':                  end.strftime('%Y-%m-%d'),
            'date_label':           date_label,
            'summary': {
                'scheduled_hours': round(scheduled_hours, 1),
                'worked_hours':    round(worked_hours, 1),
                'labor_cost':      round(total_cost, 2),
                'coverage_pct':    coverage_pct,
                'late_clockins':   late_count,
                'overtime_hours':  round(overtime_hours, 1),
                'total_shifts':    len(shifts),
                'total_staff':     len(emps),
            },
            'hours_per_day':      hours_per_day,
            'hours_per_employee': hours_per_employee[:8],  # max 8 bars
            'trend_data':         trend_data,
            'hours_by_role':      hours_by_role,
            'late_list':          late_list[:10],
        }), 200