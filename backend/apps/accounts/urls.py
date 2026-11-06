from django.urls import path
from .views import (
    RegisterView, 
    current_user, 
    update_display_mode,
    change_password,
    deactivate_account,
    admin_user_list,
    admin_user_detail,
    password_reset_request,
    password_reset_confirm,
)

app_name = 'accounts'

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('user/', current_user, name='current_user'),
    path('display-mode/', update_display_mode, name='update_display_mode'),
    path('password/', change_password, name='change_password'),
    path('password-reset/', password_reset_request, name='password_reset_request'),
    path('password-reset/confirm/', password_reset_confirm, name='password_reset_confirm'),
    path('deactivate/', deactivate_account, name='deactivate_account'),
    path('admin/users/', admin_user_list, name='admin_user_list'),
    path('admin/users/<int:user_id>/', admin_user_detail, name='admin_user_detail'),
]

