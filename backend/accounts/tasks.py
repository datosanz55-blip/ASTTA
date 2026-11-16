from celery import shared_task
from django.core.management import call_command


@shared_task
def cleanup_email_codes():
    call_command("cleanup_email_codes")
