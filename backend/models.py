from datetime import datetime, date
from sqlalchemy import Date, DateTime, Time, Text, Boolean, BigInteger, UniqueConstraint
from sqlalchemy.dialects.postgresql import CITEXT, UUID
from extensions import db
import uuid


# 1) Company
class Company(db.Model):
    __tablename__ = "company"
    comp_id = db.Column(BigInteger, primary_key=True)
    comp_name = db.Column(Text, nullable=False)
    comp_email = db.Column(CITEXT, unique=True)
    comp_address = db.Column(Text)
    is_verified = db.Column(Boolean, nullable=False, default=False)

    locations = db.relationship("Location", back_populates="company", cascade="all, delete-orphan")
    employments = db.relationship("Employment", back_populates="company", cascade="all, delete-orphan")


# 2) AppUser
class AppUser(db.Model):
    __tablename__ = "app_user"
    user_id = db.Column(BigInteger, primary_key=True)
    username = db.Column(Text, nullable=False)
    user_email = db.Column(CITEXT, unique=True, nullable=False)
    user_password = db.Column(Text, nullable=False)
    is_verified = db.Column(Boolean, nullable=False, default=False)
    display_name = db.Column(Text)

    documents = db.relationship("UserDocument", back_populates="user", cascade="all, delete-orphan")
    employments = db.relationship("Employment", back_populates="user", cascade="all, delete-orphan")
    shift_assignments = db.relationship("ShiftAssignment", back_populates="user", cascade="all, delete-orphan")


# 3) User Documents
class UserDocument(db.Model):
    __tablename__ = "user_document"
    doc_id = db.Column(BigInteger, primary_key=True)
    user_id = db.Column(BigInteger, db.ForeignKey("app_user.user_id", ondelete="CASCADE"), nullable=False)
    comp_id = db.Column(BigInteger, db.ForeignKey("company.comp_id", ondelete="CASCADE"), nullable=False)
    doc_name = db.Column(Text, nullable=False)

    user = db.relationship("AppUser", back_populates="documents")
    company = db.relationship("Company")


# 4) Location
class Location(db.Model):
    __tablename__ = "location"
    loc_id = db.Column(BigInteger, primary_key=True)
    comp_id = db.Column(BigInteger, db.ForeignKey("company.comp_id", ondelete="CASCADE"), nullable=False)
    loc_name = db.Column(Text, nullable=False)
    loc_address = db.Column(Text)

    company = db.relationship("Company", back_populates="locations")
    shifts = db.relationship("Shift", back_populates="location", cascade="all, delete-orphan")
    employments = db.relationship("Employment", back_populates="location", cascade="all, delete-orphan")


# 5) Shift
class Shift(db.Model):
    __tablename__ = "shift"
    shift_id = db.Column(BigInteger, primary_key=True)
    location_id = db.Column(BigInteger, db.ForeignKey("location.loc_id", ondelete="CASCADE"), nullable=False)
    start_time = db.Column(DateTime, nullable=False)
    end_time = db.Column(DateTime, nullable=False)
    status = db.Column(Text, nullable=False, default="draft")

    location = db.relationship("Location", back_populates="shifts")
    assignments = db.relationship("ShiftAssignment", back_populates="shift", cascade="all, delete-orphan")


# 6) Shift Assignment (composite PK)
class ShiftAssignment(db.Model):
    __tablename__ = "shift_assignment"
    shift_id = db.Column(BigInteger, db.ForeignKey("shift.shift_id", ondelete="CASCADE"), primary_key=True)
    user_id = db.Column(BigInteger, db.ForeignKey("app_user.user_id", ondelete="CASCADE"), primary_key=True)
    assigned_at = db.Column(DateTime, nullable=False, default=datetime.utcnow)

    shift = db.relationship("Shift", back_populates="assignments")
    user = db.relationship("AppUser", back_populates="shift_assignments")


# 7) Employment (linking User ↔ Company ↔ Location)
class Employment(db.Model):
    __tablename__ = "employment"
    __table_args__ = (
        UniqueConstraint("user_id", "comp_id", "location_id", name="ux_employment_user_comp_loc"),
    )

    emp_id = db.Column(BigInteger, primary_key=True)
    user_id = db.Column(BigInteger, db.ForeignKey("app_user.user_id", ondelete="CASCADE"), nullable=False)
    comp_id = db.Column(BigInteger, db.ForeignKey("company.comp_id", ondelete="CASCADE"), nullable=False)
    location_id = db.Column(BigInteger, db.ForeignKey("location.loc_id", ondelete="SET NULL"))
    # 🔥 default role = employee; owner override is set in RegistrationService
    position = db.Column(Text, nullable=False, default="employee")
    status = db.Column(Text, nullable=False, default="active")
    start_date = db.Column(Date, nullable=False, default=date.today)
    end_date = db.Column(Date)

    user = db.relationship("AppUser", back_populates="employments")
    company = db.relationship("Company", back_populates="employments")
    location = db.relationship("Location", back_populates="employments")
    availabilities = db.relationship("Availability", back_populates="employment", cascade="all, delete-orphan")


# 8) Availability (linked via Employment)
class Availability(db.Model):
    __tablename__ = "availability"
    availability_id = db.Column(BigInteger, primary_key=True)
    emp_id = db.Column(BigInteger, db.ForeignKey("employment.emp_id", ondelete="CASCADE"), nullable=False)
    day_of_week = db.Column(Text, nullable=False)  # mon..sun
    start_time = db.Column(Time, nullable=False)
    end_time = db.Column(Time, nullable=False)

    employment = db.relationship("Employment", back_populates="availabilities")


# 9) Onboarding / Invite
class OnboardingInvite(db.Model):
    __tablename__ = "onboarding_invite"
    form_id = db.Column(BigInteger, primary_key=True)
    comp_id = db.Column(BigInteger, db.ForeignKey("company.comp_id", ondelete="CASCADE"), nullable=False)
    location_id = db.Column(BigInteger, db.ForeignKey("location.loc_id", ondelete="SET NULL"))
    email = db.Column(CITEXT, nullable=False)
    status = db.Column(Text, nullable=False, default="pending")

    company = db.relationship("Company")
    location = db.relationship("Location")


class PasswordResetToken(db.Model):
    __tablename__ = "password_reset_token"
    id = db.Column(db.BigInteger, primary_key=True)
    user_id = db.Column(
        db.BigInteger,
        db.ForeignKey("app_user.user_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    token_hash = db.Column(db.String(64), nullable=False, unique=True, index=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=False)
    used_at = db.Column(db.DateTime, nullable=True)

    user = db.relationship(
        "AppUser",
        backref=db.backref("password_reset_tokens", lazy="dynamic"),
    )


class TokenBlacklist(db.Model):
    __tablename__ = "token_blacklist"

    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    jti = db.Column(db.String(64), unique=True, nullable=False, index=True)  # JWT ID
    user_id = db.Column(
        db.BigInteger,
        db.ForeignKey("app_user.user_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    token_type = db.Column(db.String(16), nullable=False)  # "access" or "refresh"
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=True)  # from JWT "exp"
    revoked_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    def __repr__(self):
        return f"<TokenBlacklist jti={self.jti} user_id={self.user_id} type={self.token_type}>"


class EmailVerificationToken(db.Model):
    __tablename__ = "email_verification_token"

    id = db.Column(db.BigInteger, primary_key=True)
    user_id = db.Column(
        db.BigInteger,
        db.ForeignKey("app_user.user_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    token_hash = db.Column(db.String(64), nullable=False, unique=True, index=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=False)
    used_at = db.Column(db.DateTime, nullable=True)

    user = db.relationship(
        "AppUser",
        backref=db.backref("email_verification_tokens", lazy="dynamic"),
    )
