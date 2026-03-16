# backend/app/cli/main.py
import typer
from app.cli.manage_organizations import app as org_app
from app.cli.manage_users import app as user_app

app = typer.Typer(
    help="Society Bug Bounty CLI tool. Use subcommands to manage the platform."
)

app.add_typer(org_app, name="orgs", help="Manage organizations (create, add users, logo).")
app.add_typer(user_app, name="users", help="Manage generic platform users (suspend, activate).")

if __name__ == "__main__":
    app()
