from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_user
from app.db.models import User
from app.models.auth import UserResponse
from app.db.session import get_session
from fastapi.security import OAuth2PasswordRequestForm
from app.models.auth import (
    SignupRequest,
    LoginRequest,
    TokenResponse,
    UserUpdateRequest,
)
from app.services.auth_service import (
    create_user,
    authenticate_user,
    count_users,
    list_users,
    get_user_by_id,
    update_user,
    delete_user,
)

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)

@router.post(
    "/signup",
    status_code=status.HTTP_201_CREATED,
)
async def signup(
    request: SignupRequest,
    session: AsyncSession = Depends(get_session),
):
    existing_count = await count_users(session)

    if existing_count == 0:
        # Bootstrap: the very first account in the system becomes admin.
        role = "admin"
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Signup is disabled. Ask an admin to create your account.",
        )

    try:
        await create_user(
            session,
            request.full_name,
            request.email,
            request.password,
            role,
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    return {
        "message": "User created successfully"
    }


@router.post(
    "/users",
    status_code=status.HTTP_201_CREATED,
)
async def create_user_by_admin(
    request: SignupRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )

    try:
        await create_user(
            session,
            request.full_name,
            request.email,
            request.password,
            request.role,
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    return {
        "message": "User created successfully"
    }


@router.get(
    "/users",
    response_model=list[UserResponse],
)
async def get_users(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )

    return await list_users(session)


@router.patch(
    "/users/{user_id}",
    response_model=UserResponse,
)
async def update_user_by_admin(
    user_id: int,
    request: UserUpdateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )

    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot change your own role or status",
        )

    target_user = await get_user_by_id(session, user_id)

    if target_user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return await update_user(
        session,
        target_user,
        role=request.role,
        is_active=request.is_active,
    )


@router.delete(
    "/users/{user_id}",
    status_code=status.HTTP_200_OK,
)
async def delete_user_by_admin(
    user_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )

    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete your own account",
        )

    target_user = await get_user_by_id(session, user_id)

    if target_user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    await delete_user(session, target_user)

    return {"message": "User deleted successfully"}

@router.post(
    "/login",
    response_model=TokenResponse,
)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    session: AsyncSession = Depends(get_session),
):
    user, token = await authenticate_user(
        session,
        form_data.username,  # User enters email here
        form_data.password,
    )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    return TokenResponse(
        access_token=token,
    )
    
@router.get(
    "/me",
    response_model=UserResponse,
)
async def get_me(
    current_user: User = Depends(get_current_user),
):
    return current_user