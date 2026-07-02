# models.py
from datetime import datetime, date
from sqlalchemy import (
    Date, DateTime, Time, Text, Boolean, BigInteger,
    Integer, UniqueConstraint, CheckConstraint
)
from sqlalchemy.dialects.postgresql import CITEXT, UUID
from extensions import db
import uuid


# ── 1. Company ────────────────────────────────────────────────────────────────
class Company(db.Model):
    __tablename__ = "company"

    comp_id      = db.Column(BigInteger, primary_key=True)
    comp_name    = db.Column(Text, nullable=False)
    comp_email   = db.Column(CITEXT, unique=True)
    comp_address = db.Column(Text)
    is_verified  = db.Column(Boolean, nullable=False, default=False)
    plan         = db.Column(Text, nullable=False, default="free")
    plan_expires = db.Column(DateTime, nullable=True)

    # ── Clock-in settings ─────────────────────────────────────────────────
    clock_in_method      = db.Column(Text, nullable=False, default="gps")
    break_duration_mins  = db.Column(Integer, nullable=False, default=30)
    max_breaks_per_shift = db.Column(Integer, nullable=True)
    paid_break           = db.Column(Boolean, nullable=False, default=False)
    gps_radius_meters    = db.Column(Integer, nullable=False, default=100)
    clock_in_pin         = db.Column(Text, nullable=True)
    pin_generated_at     = db.Column(DateTime, nullable=True)

    locations   = db.relationship("Location",   back_populates="company", cascade="all, delete-orphan")
    employments = db.relationship("Employment", back_populates="company", cascade="all, delete-orphan")


# ── 2. Location ───────────────────────────────────────────────────────────────
class Location(db.Model):
    __tablename__ = "location"

    loc_id      = db.Column(BigInteger, primary_key=True)
    comp_id     = db.Column(BigInteger, db.ForeignKey("company.comp_id", ondelete="CASCADE"), nullable=False)
    loc_name    = db.Column(Text, nullable=False)
    loc_address = db.Column(Text)
    timezone    = db.Column(Text, nullable=False, default="UTC")
    loc_lat     = db.Column(db.Float, nullable=True)
    loc_lng     = db.Column(db.Float, nullable=True)

    company     = db.relationship("Company",    back_populates="locations")
    shifts      = db.relationship("Shift",      back_populates="location", cascade="all, delete-orphan")
    employments = db.relationship("Employment", back_populates="location", cascade="all, delete-orphan")


# ── 3. AppUser ────────────────────────────────────────────────────────────────
class AppUser(db.Model):
    __tablename__ = "app_user"

    user_id       = db.Column(BigInteger, primary_key=True)
    username      = db.Column(Text, nullable=False)
    user_email    = db.Column(CITEXT, unique=True, nullable=False)
    user_password = db.Column(Text, nullable=False)
    is_verified   = db.Column(Boolean, nullable=False, default=False)
    display_name  = db.Column(Text)
    push_token    = db.Column(Text, nullable=True)
    created_at    = db.Column(DateTime, nullable=False, default=datetime.utcnow)

    documents         = db.relationship("UserDocument",    back_populates="user", cascade="all, delete-orphan")
    employments       = db.relationship("Employment",      back_populates="user", cascade="all, delete-orphan")
    shift_assignments = db.relationship(
        "ShiftAssignment",
        back_populates="user",
        cascade="all, delete-orphan",
        foreign_keys="[ShiftAssignment.user_id]",
    )
    notifications = db.relationship("Notification",  back_populates="user", cascade="all, delete-orphan")
    time_entries  = db.relationship("TimeEntry",     back_populates="user", cascade="all, delete-orphan")


# ── 4. UserDocument ───────────────────────────────────────────────────────────
class UserDocument(db.Model):
    __tablename__ = "user_document"

    doc_id   = db.Column(BigInteger, primary_key=True)
    user_id  = db.Column(BigInteger, db.ForeignKey("app_user.user_id", ondelete="CASCADE"), nullable=False)
    comp_id  = db.Column(BigInteger, db.ForeignKey("company.comp_id",  ondelete="CASCADE"), nullable=False)
    doc_name = db.Column(Text, nullable=False)

    user    = db.relationship("AppUser",  back_populates="documents")
    company = db.relationship("Company")


# ── 5. Role ───────────────────────────────────────────────────────────────────
class Role(db.Model):
    __tablename__ = "role"

    role_id     = db.Column(BigInteger, primary_key=True)
    name        = db.Column(Text, nullable=False)
    location_id = db.Column(BigInteger, db.ForeignKey("location.loc_id", ondelete="CASCADE"), nullable=False, index=True)
    is_system   = db.Column(Boolean, nullable=False, default=False)
    created_by  = db.Column(BigInteger, db.ForeignKey("app_user.user_id"), nullable=True)

    employments = db.relationship("Employment", back_populates="role")

    __table_args__ = (
        UniqueConstraint("name", "location_id", name="uq_role_name_location"),
    )


# ── 6. Employment ─────────────────────────────────────────────────────────────
class Employment(db.Model):
    __tablename__ = "employment"

    emp_id      = db.Column(BigInteger, primary_key=True)
    user_id     = db.Column(BigInteger, db.ForeignKey("app_user.user_id", ondelete="CASCADE"), nullable=False)
    comp_id     = db.Column(BigInteger, db.ForeignKey("company.comp_id",  ondelete="CASCADE"), nullable=False)
    location_id = db.Column(BigInteger, db.ForeignKey("location.loc_id",  ondelete="SET NULL"), nullable=True)
    role_id     = db.Column(BigInteger, db.ForeignKey("role.role_id"),     nullable=False, index=True)
    status      = db.Column(Text, nullable=False, default="active")
    start_date  = db.Column(Date, nullable=False, default=date.today)
    end_date    = db.Column(Date, nullable=True)
    hourly_rate          = db.Column(db.Numeric(10, 2), nullable=True)
    employment_type      = db.Column(Text, nullable=False, default="full_time")
    max_hours_week       = db.Column(Integer, nullable=True)
    overtime_eligible    = db.Column(Boolean, nullable=False, default=True)
    phone                = db.Column(Text, nullable=True)
    emergency_contact    = db.Column(Text, nullable=True)
    emergency_phone      = db.Column(Text, nullable=True)
    notes                = db.Column(Text, nullable=True)

    user     = db.relationship("AppUser",  back_populates="employments")
    company  = db.relationship("Company",  back_populates="employments")
    location = db.relationship("Location", back_populates="employments")
    role     = db.relationship("Role",     back_populates="employments")
    availabilities = db.relationship(
        "Availability",
        back_populates="employment",
        cascade="all, delete-orphan",
    )


# ── 7. Availability ───────────────────────────────────────────────────────────
class Availability(db.Model):
    __tablename__ = "availability"

    availability_id = db.Column(BigInteger, primary_key=True)
    emp_id          = db.Column(BigInteger, db.ForeignKey("employment.emp_id", ondelete="CASCADE"), nullable=False)
    day_of_week     = db.Column(Text, nullable=False)
    start_time      = db.Column(Time, nullable=False)
    end_time        = db.Column(Time, nullable=False)

    employment = db.relationship("Employment", back_populates="availabilities")

    __table_args__ = (
        CheckConstraint(
            "day_of_week IN ('mon','tue','wed','thu','fri','sat','sun')",
            name="ck_availability_day",
        ),
    )


# ── 8. Shift ──────────────────────────────────────────────────────────────────
class Shift(db.Model):
    __tablename__ = "shift"

    shift_id      = db.Column(BigInteger, primary_key=True)
    location_id   = db.Column(BigInteger, db.ForeignKey("location.loc_id", ondelete="CASCADE"), nullable=False)
    role_id       = db.Column(BigInteger, db.ForeignKey("role.role_id"),    nullable=True)
    start_time    = db.Column(DateTime(timezone=True), nullable=False)
    end_time      = db.Column(DateTime(timezone=True), nullable=False)
    break_minutes = db.Column(Integer, nullable=False, default=0)
    notes         = db.Column(Text, nullable=True)
    status        = db.Column(Text, nullable=False, default="draft")
    created_by_ai = db.Column(Boolean, nullable=False, default=False)
    created_by    = db.Column(BigInteger, db.ForeignKey("app_user.user_id"), nullable=True)
    published_at  = db.Column(DateTime, nullable=True)
    created_at    = db.Column(DateTime, nullable=False, default=datetime.utcnow)

    location     = db.relationship("Location",        back_populates="shifts")
    role         = db.relationship("Role")
    assignments  = db.relationship("ShiftAssignment", back_populates="shift", cascade="all, delete-orphan")
    swaps        = db.relationship("ShiftSwap", back_populates="shift", cascade="all, delete-orphan", foreign_keys="[ShiftSwap.shift_id]")
    time_entries = db.relationship("TimeEntry",       back_populates="shift", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint(
            "status IN ('draft','published','cancelled')",
            name="ck_shift_status",
        ),
    )


# ── 9. ShiftAssignment ────────────────────────────────────────────────────────
class ShiftAssignment(db.Model):
    __tablename__ = "shift_assignment"

    shift_id    = db.Column(BigInteger, db.ForeignKey("shift.shift_id",   ondelete="CASCADE"), primary_key=True)
    user_id     = db.Column(BigInteger, db.ForeignKey("app_user.user_id", ondelete="CASCADE"), primary_key=True)
    assigned_at = db.Column(DateTime, nullable=False, default=datetime.utcnow)
    assigned_by = db.Column(BigInteger, db.ForeignKey("app_user.user_id"), nullable=True)

    shift            = db.relationship("Shift",   back_populates="assignments")
    user             = db.relationship("AppUser", back_populates="shift_assignments", foreign_keys=[user_id])
    assigned_by_user = db.relationship("AppUser", foreign_keys=[assigned_by])


# ── 10. ShiftSwap ─────────────────────────────────────────────────────────────
class ShiftSwap(db.Model):
    __tablename__ = "shift_swap"

    swap_id            = db.Column(BigInteger, primary_key=True)
    shift_id           = db.Column(BigInteger, db.ForeignKey("shift.shift_id",   ondelete="CASCADE"), nullable=False)
    requesting_user_id = db.Column(BigInteger, db.ForeignKey("app_user.user_id", ondelete="CASCADE"), nullable=False)
    receiving_user_id  = db.Column(BigInteger, db.ForeignKey("app_user.user_id", ondelete="CASCADE"), nullable=True)
    offered_shift_id   = db.Column(BigInteger, db.ForeignKey("shift.shift_id",   ondelete="SET NULL"), nullable=True)
    swap_type          = db.Column(Text, nullable=False, default="open")  # open | targeted
    reason             = db.Column(Text, nullable=True)
    status             = db.Column(Text, nullable=False, default="pending")
    manager_approved   = db.Column(Boolean, nullable=True)
    ai_suggested       = db.Column(Boolean, nullable=False, default=False)
    created_at         = db.Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at         = db.Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    shift           = db.relationship("Shift", back_populates="swaps",      foreign_keys=[shift_id])
    offered_shift   = db.relationship("Shift",                              foreign_keys=[offered_shift_id])
    requesting_user = db.relationship("AppUser", foreign_keys=[requesting_user_id])
    receiving_user  = db.relationship("AppUser", foreign_keys=[receiving_user_id])

    __table_args__ = (
        CheckConstraint(
            "status IN ('pending','offer_pending','accepted','rejected','approved','cancelled')",
            name="ck_swap_status",
        ),
        CheckConstraint(
            "swap_type IN ('open','targeted')",
            name="ck_swap_type",
        ),
    )


# ── 11. Notification ──────────────────────────────────────────────────────────
class Notification(db.Model):
    __tablename__ = "notification"

    notif_id   = db.Column(BigInteger, primary_key=True)
    user_id    = db.Column(BigInteger, db.ForeignKey("app_user.user_id", ondelete="CASCADE"), nullable=False)
    notif_type = db.Column(Text, nullable=False)
    title      = db.Column(Text, nullable=False)
    body       = db.Column(Text, nullable=False)
    data       = db.Column(db.JSON, nullable=True)
    is_read    = db.Column(Boolean, nullable=False, default=False)
    sent_push  = db.Column(Boolean, nullable=False, default=False)
    created_at = db.Column(DateTime, nullable=False, default=datetime.utcnow)

    user = db.relationship("AppUser", back_populates="notifications")


# ── 12. TimeEntry ─────────────────────────────────────────────────────────────
class TimeEntry(db.Model):
    __tablename__ = "time_entry"

    entry_id      = db.Column(BigInteger, primary_key=True)
    user_id       = db.Column(BigInteger, db.ForeignKey("app_user.user_id", ondelete="CASCADE"), nullable=False)
    shift_id      = db.Column(BigInteger, db.ForeignKey("shift.shift_id",   ondelete="SET NULL"), nullable=True)
    clock_in      = db.Column(DateTime(timezone=True), nullable=False)
    clock_out     = db.Column(DateTime(timezone=True), nullable=True)
    total_minutes = db.Column(Integer, nullable=True)
    notes         = db.Column(Text, nullable=True)
    created_at    = db.Column(DateTime, nullable=False, default=datetime.utcnow)

    user   = db.relationship("AppUser", back_populates="time_entries")
    shift  = db.relationship("Shift",   back_populates="time_entries")
    breaks = db.relationship(
        "BreakEntry",
        back_populates="time_entry",
        cascade="all, delete-orphan",
        order_by="BreakEntry.break_start",
    )


# ── 13. BreakEntry ────────────────────────────────────────────────────────────
class BreakEntry(db.Model):
    __tablename__ = "break_entry"

    break_id         = db.Column(BigInteger, primary_key=True)
    entry_id         = db.Column(
        BigInteger,
        db.ForeignKey("time_entry.entry_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    break_start      = db.Column(DateTime(timezone=True), nullable=False)
    break_end        = db.Column(DateTime(timezone=True), nullable=True)
    duration_minutes = db.Column(Integer, nullable=True)

    time_entry = db.relationship("TimeEntry", back_populates="breaks")


# ── 14. OnboardingInvite ──────────────────────────────────────────────────────
class OnboardingInvite(db.Model):
    __tablename__ = "onboarding_invite"

    form_id     = db.Column(BigInteger, primary_key=True)
    comp_id     = db.Column(BigInteger, db.ForeignKey("company.comp_id",  ondelete="CASCADE"), nullable=False)
    location_id = db.Column(BigInteger, db.ForeignKey("location.loc_id",  ondelete="SET NULL"), nullable=True)
    email       = db.Column(CITEXT, nullable=False)
    status      = db.Column(Text, nullable=False, default="pending")

    company  = db.relationship("Company")
    location = db.relationship("Location")


# ── 15. PasswordResetToken ────────────────────────────────────────────────────
class PasswordResetToken(db.Model):
    __tablename__ = "password_reset_token"

    id         = db.Column(BigInteger, primary_key=True)
    user_id    = db.Column(BigInteger, db.ForeignKey("app_user.user_id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash = db.Column(db.String(64), nullable=False, unique=True, index=True)
    created_at = db.Column(DateTime, nullable=False, default=datetime.utcnow)
    expires_at = db.Column(DateTime, nullable=False)
    used_at    = db.Column(DateTime, nullable=True)

    user = db.relationship("AppUser", backref=db.backref("password_reset_tokens", lazy="dynamic"))


# ── 16. TokenBlacklist ────────────────────────────────────────────────────────
class TokenBlacklist(db.Model):
    __tablename__ = "token_blacklist"

    id         = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    jti        = db.Column(db.String(64), unique=True, nullable=False, index=True)
    user_id    = db.Column(BigInteger, db.ForeignKey("app_user.user_id", ondelete="CASCADE"), nullable=False, index=True)
    token_type = db.Column(db.String(16), nullable=False)
    created_at = db.Column(DateTime, nullable=False, default=datetime.utcnow)
    expires_at = db.Column(DateTime, nullable=True)
    revoked_at = db.Column(DateTime, nullable=False, default=datetime.utcnow)


# ── 17. EmailVerificationToken ────────────────────────────────────────────────
class EmailVerificationToken(db.Model):
    __tablename__ = "email_verification_token"

    id         = db.Column(BigInteger, primary_key=True)
    user_id    = db.Column(BigInteger, db.ForeignKey("app_user.user_id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash = db.Column(db.String(64), nullable=False, unique=True, index=True)
    created_at = db.Column(DateTime, nullable=False, default=datetime.utcnow)
    expires_at = db.Column(DateTime, nullable=False)
    used_at    = db.Column(DateTime, nullable=True)

    user = db.relationship("AppUser", backref=db.backref("email_verification_tokens", lazy="dynamic"))
    
    
# ── 18. ShiftDrop ─────────────────────────────────────────────────────────────
class ShiftDrop(db.Model):
    __tablename__ = "shift_drop"

    drop_id    = db.Column(BigInteger, primary_key=True)
    shift_id   = db.Column(BigInteger, db.ForeignKey("shift.shift_id",   ondelete="CASCADE"), nullable=False)
    user_id    = db.Column(BigInteger, db.ForeignKey("app_user.user_id", ondelete="CASCADE"), nullable=False)
    reason     = db.Column(Text, nullable=True)
    status     = db.Column(Text, nullable=False, default="pending")
    created_at = db.Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    shift = db.relationship("Shift")
    user  = db.relationship("AppUser")

    __table_args__ = (
        CheckConstraint(
            "status IN ('pending','approved','rejected','cancelled')",
            name="ck_drop_status",
        ),
    )
    
    
# ── 19. TimeOffRequest ────────────────────────────────────────────────────────
class TimeOffRequest(db.Model):
    __tablename__ = "time_off_request"

    request_id    = db.Column(BigInteger, primary_key=True)
    user_id       = db.Column(BigInteger, db.ForeignKey("app_user.user_id", ondelete="CASCADE"), nullable=False)
    comp_id       = db.Column(BigInteger, db.ForeignKey("company.comp_id",  ondelete="CASCADE"), nullable=False)
    start_date    = db.Column(Date, nullable=False)
    end_date      = db.Column(Date, nullable=False)
    request_type  = db.Column(Text, nullable=False, default="vacation")
    reason        = db.Column(Text, nullable=True)
    status        = db.Column(Text, nullable=False, default="pending")
    manager_notes = db.Column(Text, nullable=True)
    created_at    = db.Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at    = db.Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    user    = db.relationship("AppUser")
    company = db.relationship("Company")

    __table_args__ = (
        CheckConstraint(
            "status IN ('pending','approved','rejected','cancelled')",
            name="ck_timeoff_status",
        ),
        CheckConstraint(
            "request_type IN ('vacation','sick','personal','other')",
            name="ck_timeoff_type",
        ),
    )