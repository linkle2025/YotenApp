# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('fortune', '0007_fortunecalculation_hour_unknown'),
    ]

    operations = [
        migrations.AddField(
            model_name='fortunecalculation',
            name='five_elements_balance_data',
            field=models.JSONField(blank=True, default=dict, verbose_name='五行バランスデータ'),
        ),
    ]

