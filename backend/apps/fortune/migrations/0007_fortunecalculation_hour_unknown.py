# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('fortune', '0006_fortunecalculation_birth_minute'),
    ]

    operations = [
        migrations.AddField(
            model_name='fortunecalculation',
            name='hour_unknown',
            field=models.BooleanField(default=False, verbose_name='時間不明'),
        ),
    ]

