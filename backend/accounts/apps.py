from django.apps import AppConfig
import os

class AccountsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'accounts'

    def ready(self):
        import accounts.signals

        # чтобы выполнялось только на Render
        if os.environ.get("RENDER") != "true":
            return

        username = os.environ.get("DJANGO_SUPERUSER_USERNAME")
        email = os.environ.get("DJANGO_SUPERUSER_EMAIL")
        password = os.environ.get("DJANGO_SUPERUSER_PASSWORD")

        if not username or not email or not password:
            return

        try:
            from django.contrib.auth.models import User

            if not User.objects.filter(username=username).exists():
                User.objects.create_superuser(
                    username=username,
                    email=email,
                    password=password,
                )
                print("✅ Superuser created")
        except Exception as e:
            print("❌ Error creating superuser:", e)