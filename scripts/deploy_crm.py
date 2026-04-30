"""Deploy CRM layer to server via paramiko."""
import paramiko
import os

HOST = "62.181.53.36"
USER = "root"
PASSWORD = "gtkmvtyb2314"
REMOTE_ROOT = "/root/CRM"
LOCAL_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

FILES_TO_UPLOAD = [
    # Backend models
    "backend/app/models/__init__.py",
    "backend/app/models/crm_company.py",
    "backend/app/models/crm_contact.py",
    "backend/app/models/crm_pipeline.py",
    "backend/app/models/crm_lead.py",
    "backend/app/models/crm_deal.py",
    "backend/app/models/crm_custom_field.py",
    "backend/app/models/crm_project.py",
    "backend/app/models/crm_task.py",
    "backend/app/models/crm_automation.py",
    "backend/app/models/crm_file.py",
    "backend/app/models/crm_commerce.py",
    "backend/app/models/crm_notification.py",
    # Migration
    "backend/alembic/versions/0005_crm_layer.py",
    # Schemas
    "backend/app/schemas/crm.py",
    # Routers
    "backend/app/routers/crm_companies.py",
    "backend/app/routers/crm_contacts.py",
    "backend/app/routers/crm_pipelines.py",
    "backend/app/routers/crm_leads.py",
    "backend/app/routers/crm_deals.py",
    "backend/app/routers/crm_tasks.py",
    "backend/app/routers/crm_projects.py",
    "backend/app/routers/crm_automation.py",
    "backend/app/routers/crm_files.py",
    "backend/app/routers/crm_commerce.py",
    "backend/app/routers/crm_analytics.py",
    "backend/app/routers/crm_notifications.py",
    "backend/app/routers/crm_custom_fields.py",
    # Main + tasks
    "backend/app/main.py",
    "backend/app/tasks.py",
    # Frontend API proxy routes
    "frontend/site/app/api/crm/companies/route.ts",
    "frontend/site/app/api/crm/companies/[id]/route.ts",
    "frontend/site/app/api/crm/contacts/route.ts",
    "frontend/site/app/api/crm/contacts/[id]/route.ts",
    "frontend/site/app/api/crm/pipelines/route.ts",
    "frontend/site/app/api/crm/pipelines/[id]/route.ts",
    "frontend/site/app/api/crm/pipelines/[id]/stages/route.ts",
    "frontend/site/app/api/crm/pipelines/[id]/stages/[stageId]/route.ts",
    "frontend/site/app/api/crm/leads/route.ts",
    "frontend/site/app/api/crm/leads/[id]/route.ts",
    "frontend/site/app/api/crm/deals/route.ts",
    "frontend/site/app/api/crm/deals/[id]/route.ts",
    "frontend/site/app/api/crm/tasks/route.ts",
    "frontend/site/app/api/crm/tasks/[id]/route.ts",
    "frontend/site/app/api/crm/projects/route.ts",
    "frontend/site/app/api/crm/projects/[id]/route.ts",
    "frontend/site/app/api/crm/automation/route.ts",
    "frontend/site/app/api/crm/automation/[id]/route.ts",
    "frontend/site/app/api/crm/files/route.ts",
    "frontend/site/app/api/crm/files/[id]/download/route.ts",
    "frontend/site/app/api/crm/commerce/quotes/route.ts",
    "frontend/site/app/api/crm/commerce/quotes/[id]/route.ts",
    "frontend/site/app/api/crm/commerce/invoices/route.ts",
    "frontend/site/app/api/crm/commerce/invoices/[id]/route.ts",
    "frontend/site/app/api/crm/analytics/route.ts",
    "frontend/site/app/api/crm/analytics/funnel/route.ts",
    "frontend/site/app/api/crm/analytics/tasks/route.ts",
    "frontend/site/app/api/crm/notifications/route.ts",
    "frontend/site/app/api/crm/notifications/read-all/route.ts",
    "frontend/site/app/api/crm/notifications/[id]/read/route.ts",
    "frontend/site/app/api/crm/custom-fields/route.ts",
    # Frontend components
    "frontend/site/components/CrmNav.tsx",
    "frontend/site/components/CrmBoard.tsx",
    "frontend/site/components/crm/KanbanBoard.tsx",
    "frontend/site/components/crm/CompaniesPage.tsx",
    "frontend/site/components/crm/ContactsPage.tsx",
    "frontend/site/components/crm/LeadsPage.tsx",
    "frontend/site/components/crm/DealsPage.tsx",
    "frontend/site/components/crm/TasksPage.tsx",
    "frontend/site/components/crm/ProjectsPage.tsx",
    "frontend/site/components/crm/AutomationPage.tsx",
    "frontend/site/components/crm/AnalyticsPage.tsx",
    "frontend/site/components/crm/NotificationsPage.tsx",
    # Frontend pages
    "frontend/site/app/crm/companies/page.tsx",
    "frontend/site/app/crm/contacts/page.tsx",
    "frontend/site/app/crm/leads/page.tsx",
    "frontend/site/app/crm/deals/page.tsx",
    "frontend/site/app/crm/tasks/page.tsx",
    "frontend/site/app/crm/projects/page.tsx",
    "frontend/site/app/crm/automation/page.tsx",
    "frontend/site/app/crm/analytics/page.tsx",
    "frontend/site/app/crm/notifications/page.tsx",
]


def run(client, cmd, timeout=300):
    print(f"  $ {cmd[:100]}")
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode()
    err = stderr.read().decode()
    rc = stdout.channel.recv_exit_status()
    if out.strip():
        print("  OUT:", out.strip()[:500])
    if err.strip() and rc != 0:
        print("  ERR:", err.strip()[:500])
    return out, err, rc


def main():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting to {HOST}...")
    client.connect(HOST, username=USER, password=PASSWORD, timeout=30)
    print("Connected!")

    sftp = client.open_sftp()

    # Create all remote directories first
    dirs = set()
    for f in FILES_TO_UPLOAD:
        parts = f.replace("\\", "/").split("/")
        for i in range(1, len(parts)):
            dirs.add("/".join(parts[:i]))

    for d in sorted(dirs):
        remote_dir = f"{REMOTE_ROOT}/{d}"
        try:
            sftp.stat(remote_dir)
        except FileNotFoundError:
            try:
                sftp.mkdir(remote_dir)
                print(f"  Created dir: {remote_dir}")
            except Exception as e:
                print(f"  mkdir failed {remote_dir}: {e}")

    # Upload files
    print(f"\nUploading {len(FILES_TO_UPLOAD)} files...")
    for rel in FILES_TO_UPLOAD:
        local = os.path.join(LOCAL_ROOT, rel.replace("/", os.sep))
        remote = f"{REMOTE_ROOT}/{rel}"
        if not os.path.exists(local):
            print(f"  SKIP (missing locally): {rel}")
            continue
        try:
            sftp.put(local, remote)
            print(f"  OK {rel}")
        except Exception as e:
            print(f"  FAIL {rel}: {e}")

    sftp.close()

    print("\n--- Running migrations ---")
    out, err, rc = run(client, "cd /root/CRM && docker compose exec -T backend alembic upgrade head", timeout=120)
    print("Migration rc:", rc)

    print("\n--- Rebuilding backend ---")
    out, err, rc = run(client, "cd /root/CRM && docker compose build backend celery", timeout=600)
    print("Build rc:", rc)

    print("\n--- Rebuilding frontend ---")
    out, err, rc = run(client, "cd /root/CRM && docker compose build frontend", timeout=600)
    print("Frontend build rc:", rc)

    print("\n--- Restarting services ---")
    out, err, rc = run(client, "cd /root/CRM && docker compose up -d --force-recreate backend celery frontend", timeout=120)
    print("Restart rc:", rc)

    print("\n--- Health check ---")
    out, err, rc = run(client, "sleep 5 && curl -s http://localhost:8000/api/health", timeout=30)
    print("Health:", out.strip())

    client.close()
    print("\nDeploy complete!")


if __name__ == "__main__":
    main()
