# backend/app/cli/manage_users.py
import asyncio
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import typer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.src.users.service import UserService
from app.core.exceptions import NotFoundException, BadRequestException
from app.cli.utils import format_cli_error

# Creates the Typer application for user management
app = typer.Typer(help="Manage users in the system.")


@asynccontextmanager
async def get_deps() -> AsyncGenerator[UserService, None]:
    """Manually initializes and yields dependencies for use in a CLI context."""
    session_generator = get_session()
    session: AsyncSession = await anext(session_generator)

    try:
        user_service = UserService(session)
        yield user_service
    finally:
        await session.close()


@app.command()
def suspend(
    email: str = typer.Option(..., "--email", "-e", help="Email of the user to suspend")
):
    """Suspends a user account, preventing them from logging in."""
    async def _suspend():
        async with get_deps() as user_service:
            try:
                user = await user_service.set_user_activity_status(email=email, is_active=False)
                typer.echo(f"✅ User '{user.email}' has been successfully suspended.")
            except (NotFoundException, BadRequestException) as e:
                typer.echo(f"❌ Error {format_cli_error(e.detail)}")
                raise typer.Exit(code=1)

    asyncio.run(_suspend())


@app.command()
def activate(
    email: str = typer.Option(..., "--email", "-e", help="Email of the user to activate")
):
    """Activates a suspended user account, re-allowing login."""
    async def _activate():
        async with get_deps() as user_service:
            try:
                user = await user_service.set_user_activity_status(email=email, is_active=True)
                typer.echo(f"✅ User '{user.email}' has been successfully activated (is_active=True).")
            except (NotFoundException, BadRequestException) as e:
                typer.echo(f"❌ Error {format_cli_error(e.detail)}")
                raise typer.Exit(code=1)

    asyncio.run(_activate())


if __name__ == "__main__":
    app()
