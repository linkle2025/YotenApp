# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('fortune', '0005_fortunecalculation_day_pillar_heavenly_stem_star_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='fortunecalculation',
            name='birth_minute',
            field=models.IntegerField(default=0, verbose_name='生分'),
        ),
    ]

