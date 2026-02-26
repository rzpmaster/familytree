import uuid

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from .database import Base


def generate_uuid():
    return str(uuid.uuid4())


# Association table for Member <-> Region
member_regions = Table(
    "member_regions",
    Base.metadata,
    Column("member_id", String, ForeignKey("members.id"), primary_key=True),
    Column("region_id", String, ForeignKey("regions.id"), primary_key=True),
)


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=generate_uuid)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    name = Column(String, nullable=False)
    is_superuser = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), onupdate=func.now(), server_default=func.now()
    )

    families = relationship("Family", back_populates="owner")
    shared_families = relationship("FamilyCollaborator", back_populates="user")
    access_requests = relationship(
        "AccessRequest", back_populates="user", cascade="all, delete-orphan"
    )


class FamilyCollaborator(Base):
    __tablename__ = "family_collaborators"

    family_id = Column(String, ForeignKey("families.id"), primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), primary_key=True)
    role = Column(
        String, default="viewer", nullable=False
    )  # 'viewer', 'editor', 'admin'
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    family = relationship("Family", back_populates="collaborators")
    user = relationship("User", back_populates="shared_families")


class AccessRequest(Base):
    __tablename__ = "access_requests"

    id = Column(String, primary_key=True, default=generate_uuid)
    family_id = Column(String, ForeignKey("families.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    status = Column(
        String, default="pending", nullable=False
    )  # 'pending', 'approved', 'rejected'
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), onupdate=func.now(), server_default=func.now()
    )

    family = relationship("Family", back_populates="access_requests")
    user = relationship("User", back_populates="access_requests")


class Family(Base):
    __tablename__ = "families"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    family_name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    owner = relationship("User", back_populates="families")
    collaborators = relationship(
        "FamilyCollaborator", back_populates="family", cascade="all, delete-orphan"
    )
    members = relationship(
        "Member", back_populates="family", cascade="all, delete-orphan"
    )
    access_requests = relationship(
        "AccessRequest", back_populates="family", cascade="all, delete-orphan"
    )
    regions = relationship(
        "Region", back_populates="family", cascade="all, delete-orphan"
    )


class Region(Base):
    __tablename__ = "regions"

    id = Column(String, primary_key=True, default=generate_uuid)
    family_id = Column(String, ForeignKey("families.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    color = Column(String, default="#EBF8FF")  # Default light blue
    linked_family_id = Column(String, nullable=True)  # Links to another family
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    family = relationship("Family", back_populates="regions")
    members = relationship("Member", secondary=member_regions, back_populates="regions")


class Member(Base):
    __tablename__ = "members"

    id = Column(String, primary_key=True, default=generate_uuid)
    family_id = Column(String, ForeignKey("families.id"), nullable=False)
    # region_id removed in favor of many-to-many
    name = Column(String, nullable=False, index=True)
    surname = Column(String, nullable=True)
    gender = Column(String, nullable=False)  # 'male', 'female'
    birth_date = Column(String, nullable=True)
    death_date = Column(String, nullable=True)
    is_deceased = Column(Boolean, default=False)
    is_fuzzy = Column(Boolean, default=False)
    remark = Column(String, nullable=True)
    birth_place = Column(String, nullable=True)
    photo_url = Column(String, nullable=True)
    # position_x and position_y moved to MemberPosition table
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), onupdate=func.now(), server_default=func.now()
    )

    family = relationship("Family", back_populates="members")
    regions = relationship("Region", secondary=member_regions, back_populates="members")
    positions = relationship(
        "MemberPosition", back_populates="member", cascade="all, delete-orphan"
    )

    # Relationships where this member is member1 (spouse)
    spouse_relationships_1 = relationship(
        "SpouseRelationship",
        foreign_keys="[SpouseRelationship.member1_id]",
        back_populates="member1",
        cascade="all, delete-orphan",
    )
    # Relationships where this member is member2 (spouse)
    spouse_relationships_2 = relationship(
        "SpouseRelationship",
        foreign_keys="[SpouseRelationship.member2_id]",
        back_populates="member2",
        cascade="all, delete-orphan",
    )

    # Relationships where this member is parent
    parent_relationships = relationship(
        "ParentChildRelationship",
        foreign_keys="[ParentChildRelationship.parent_id]",
        back_populates="parent",
        cascade="all, delete-orphan",
    )
    # Relationships where this member is child
    child_relationships = relationship(
        "ParentChildRelationship",
        foreign_keys="[ParentChildRelationship.child_id]",
        back_populates="child",
        cascade="all, delete-orphan",
    )


class SpouseRelationship(Base):
    __tablename__ = "spouse_relationships"

    id = Column(String, primary_key=True, default=generate_uuid)
    member1_id = Column(String, ForeignKey("members.id"), nullable=False)
    member2_id = Column(String, ForeignKey("members.id"), nullable=False)
    marriage_date = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    member1 = relationship(
        "Member", foreign_keys=[member1_id], back_populates="spouse_relationships_1"
    )
    member2 = relationship(
        "Member", foreign_keys=[member2_id], back_populates="spouse_relationships_2"
    )

    __table_args__ = (
        UniqueConstraint("member1_id", "member2_id", name="unique_spouses"),
    )


class ParentChildRelationship(Base):
    __tablename__ = "parent_child_relationships"

    id = Column(String, primary_key=True, default=generate_uuid)
    parent_id = Column(String, ForeignKey("members.id"), nullable=False)
    child_id = Column(String, ForeignKey("members.id"), nullable=False)
    relationship_type = Column(String, nullable=False)  # 'father', 'mother'
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    parent = relationship(
        "Member", foreign_keys=[parent_id], back_populates="parent_relationships"
    )
    child = relationship(
        "Member", foreign_keys=[child_id], back_populates="child_relationships"
    )

    __table_args__ = (
        UniqueConstraint(
            "parent_id", "child_id", "relationship_type", name="unique_parent_child"
        ),
    )


class MemberPosition(Base):
    __tablename__ = "member_positions"

    id = Column(String, primary_key=True, default=generate_uuid)
    member_id = Column(String, ForeignKey("members.id"), nullable=False)
    family_id = Column(String, ForeignKey("families.id"), nullable=False)
    x = Column(Integer, default=0)
    y = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), onupdate=func.now(), server_default=func.now()
    )

    member = relationship("Member", back_populates="positions")
    family = relationship("Family")

    __table_args__ = (
        UniqueConstraint(
            "member_id", "family_id", name="unique_member_position_per_family"
        ),
    )
