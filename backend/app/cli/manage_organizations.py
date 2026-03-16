# backend/app/cli/manage_organizations.py
import asyncio
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import typer
from sqlalchemy.ext.asyncio import AsyncSession
import io
from pathlib import Path
from fastapi import UploadFile

# --- Application Imports ---
from app.core.database import get_session
from app.src.users.manager import UserManager
from fastapi_users_db_sqlalchemy import SQLAlchemyUserDatabase
from app.src.users.models import User, OAuthAccount
from app.src.organizations.service import OrganizationService
from app.core.exceptions import NotFoundException, AlreadyExistsException, BadRequestException

# Creates the main Typer application for the command-line interface.
app = typer.Typer()


from app.cli.utils import format_cli_error


@asynccontextmanager
async def get_deps() -> AsyncGenerator[OrganizationService, None]:
    """
    Manually initializes and yields dependencies for use in a CLI context.

    This context manager replicates the dependency injection that FastAPI handles
    automatically for HTTP requests. It builds the required service layer
    by constructing its dependencies (session, database adapter, user manager)
    from the ground up.
    """
    session_generator = get_session()
    session: AsyncSession = await anext(session_generator)

    try:
        # 1. Create the user database adapter.
        user_db = SQLAlchemyUserDatabase(session, User, OAuthAccount)

        # 2. Create the custom user manager.
        user_manager = UserManager(user_db)

        # 3. Create the organization service, injecting the session and user manager.
        org_service = OrganizationService(session, user_manager)

        # 4. Yield the fully constructed service for the command to use.
        yield org_service
    finally:
        # 5. Ensure the database session is closed after the command finishes.
        await session.close()


# --- CLI Commands ---
# These commands use the OrganizationService provided by the get_deps context manager.

@app.command()
def create_org(name: str = typer.Option(..., "--name", "-n"), logo_url: str = typer.Option(None, "--logo", "-l")):
    """Creates a new organization in the database."""
    async def _create_org():
        async with get_deps() as org_service:
            try:
                new_org = await org_service.create_organization(name=name, logo_url=logo_url)
                typer.echo(f"✅ Organization '{new_org.name}' created successfully")
                typer.echo(f"   ID: {new_org.id}")
                typer.echo(f"   Slug: {new_org.slug}")
            except (AlreadyExistsException, BadRequestException) as e:
                typer.echo(f"❌ Error: {format_cli_error(e.detail)}")
                raise typer.Exit(code=1)
    asyncio.run(_create_org())


@app.command()
def add_user(email: str = typer.Option(..., "--email", "-e"), org_slug: str = typer.Option(..., "--org", "-o", help="Slug of the organization (not the full name)")):
    """Adds an existing user to an organization."""
    async def _add_user():
        async with get_deps() as org_service:
            try:
                await org_service.add_user_to_organization(email, org_slug)
                typer.echo(f"✅ User '{email}' added to organization '{org_slug}' successfully")
            except NotFoundException as e:
                typer.echo(f"❌ Error: {format_cli_error(e.detail)}")
                raise typer.Exit(code=1)
    asyncio.run(_add_user())


@app.command()
def remove_user(email: str = typer.Option(..., "--email", "-e"), org_slug: str = typer.Option(..., "--org", "-o", help="Slug of the organization (not the full name)")):
    """Removes a user from an organization."""
    async def _remove_user():
        async with get_deps() as org_service:
            try:
                await org_service.remove_user_from_organization(email, org_slug)
                typer.echo(f"✅ User '{email}' removed from organization '{org_slug}' successfully")
            except NotFoundException as e:
                typer.echo(f"❌ Error: {format_cli_error(e.detail)}")
                raise typer.Exit(code=1)
    asyncio.run(_remove_user())


@app.command()
def update_logo(
    org_slug: str = typer.Option(..., "--org", "-o", help="Slug of the organization to update"),
    file_path: Path = typer.Option(
        ...,
        "--file", "-f",
        help="Local path to the image file (e.g., ./logos/my-logo.png)",
        exists=True,
        file_okay=True,
        dir_okay=False,
        readable=True
    )
):
    """
    Uploads a local image and assigns it as the organization's logo.
    Uses the service layer to validate, save, and clean up old logos.
    """
    async def _update_logo():
        async with get_deps() as org_service:
            try:
                # 1. Read the bytes from the local file
                with open(file_path, "rb") as f:
                    file_content = f.read()

                # 2. Create an in-memory byte buffer (simulating an open file)
                file_object = io.BytesIO(file_content)

                # 3. Construct the UploadFile object expected by the service.
                # It is CRITICAL to pass the correct 'filename' so the service
                # can validate the extension (.jpg, .png, etc.)
                upload_file = UploadFile(file=file_object, filename=file_path.name)

                typer.echo(f"🔄 Processing image '{file_path.name}' for organization '{org_slug}'...")

                # 4. Call the existing service method.
                # This handles validation, deletion of old files, saving to disk, and DB updates.
                updated_org = await org_service.upload_logo(org_slug, upload_file)

                typer.echo(f"✅ Logo updated successfully.")
                typer.echo(f"   Organization: {updated_org.name}")
                typer.echo(f"   New URL: {updated_org.logo_url}")

            except NotFoundException as e:
                typer.echo(f"❌ Error: {format_cli_error(e.detail)}")
                raise typer.Exit(code=1)
            except Exception as e:
                # Catch image validation errors (size, format) or IO errors
                typer.echo(f"❌ Error processing image: {str(e)}")
                raise typer.Exit(code=1)
            finally:
                # Good practice: close the UploadFile wrapper
                if 'upload_file' in locals():
                    await upload_file.close()

    asyncio.run(_update_logo())


if __name__ == "__main__":
    app()