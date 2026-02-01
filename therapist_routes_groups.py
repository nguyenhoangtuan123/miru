"""
Therapist Routes - Client Groups
API endpoints cho quản lý nhóm thân chủ
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
from therapist_service import get_therapist_service
from auth_middleware import require_auth_for_user

router = APIRouter(prefix="/api/therapist", tags=["Therapist Groups"])


# === Pydantic Models ===

class GroupCreate(BaseModel):
    name: str
    description: Optional[str] = None
    color: Optional[str] = None


class GroupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None


class AddClientToGroup(BaseModel):
    client_id: str


# === GROUP ROUTES ===

@router.get("/client-groups/{therapist_id}")
async def get_client_groups(therapist_id: str, request: Request):
    """Lấy danh sách nhóm thân chủ"""
    await require_auth_for_user(request, therapist_id)
    service = get_therapist_service()
    groups = service.groups.get_client_groups(therapist_id)
    return {"success": True, "groups": groups}


@router.get("/client-groups/{therapist_id}/{group_id}")
async def get_client_group(
    therapist_id: str, 
    group_id: int, 
    request: Request
):
    """Lấy chi tiết một nhóm"""
    await require_auth_for_user(request, therapist_id)
    service = get_therapist_service()
    group = service.groups.get_client_group(group_id, therapist_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    return {"success": True, "group": group}


@router.post("/client-groups/{therapist_id}")
async def create_client_group(
    therapist_id: str, 
    data: GroupCreate, 
    request: Request
):
    """Tạo nhóm thân chủ mới"""
    await require_auth_for_user(request, therapist_id)
    service = get_therapist_service()
    group = service.groups.create_client_group(
        therapist_id=therapist_id,
        name=data.name,
        description=data.description,
        color=data.color
    )
    if not group:
        raise HTTPException(status_code=400, detail="Failed to create group")
    return {"success": True, "group": group}


@router.put("/client-groups/{therapist_id}/{group_id}")
async def update_client_group(
    therapist_id: str, 
    group_id: int, 
    data: GroupUpdate, 
    request: Request
):
    """Cập nhật nhóm"""
    await require_auth_for_user(request, therapist_id)
    service = get_therapist_service()
    group = service.groups.update_client_group(
        group_id, therapist_id, data.dict(exclude_unset=True)
    )
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    return {"success": True, "group": group}


@router.delete("/client-groups/{therapist_id}/{group_id}")
async def delete_client_group(
    therapist_id: str, 
    group_id: int, 
    request: Request
):
    """Xóa nhóm"""
    await require_auth_for_user(request, therapist_id)
    service = get_therapist_service()
    result = service.groups.delete_client_group(group_id, therapist_id)
    return {"success": result}


@router.post("/client-groups/{therapist_id}/{group_id}/members")
async def add_client_to_group(
    therapist_id: str, 
    group_id: int, 
    data: AddClientToGroup, 
    request: Request
):
    """Thêm thân chủ vào nhóm"""
    await require_auth_for_user(request, therapist_id)
    service = get_therapist_service()
    try:
        member = service.groups.add_client_to_group(
            group_id, data.client_id, therapist_id
        )
        return {"success": True, "member": member}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/client-groups/{therapist_id}/{group_id}/members/{client_id}")
async def remove_client_from_group(
    therapist_id: str, 
    group_id: int, 
    client_id: str, 
    request: Request
):
    """Xóa thân chủ khỏi nhóm"""
    await require_auth_for_user(request, therapist_id)
    service = get_therapist_service()
    result = service.groups.remove_client_from_group(group_id, client_id, therapist_id)
    return {"success": result}


@router.get("/clients/{therapist_id}/{client_id}/groups")
async def get_client_groups_for_client(
    therapist_id: str, 
    client_id: str, 
    request: Request
):
    """Lấy danh sách nhóm mà thân chủ thuộc về"""
    await require_auth_for_user(request, therapist_id)
    service = get_therapist_service()
    groups = service.groups.get_client_groups_for_client(client_id, therapist_id)
    return {"success": True, "groups": groups}
