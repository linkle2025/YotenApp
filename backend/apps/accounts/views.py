from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.contrib.auth.models import User
from django.contrib.auth import update_session_auth_hash
from .serializers import (
    UserRegistrationSerializer, 
    UserSerializer, 
    UserProfileSerializer,
    UserUpdateSerializer,
    PasswordChangeSerializer,
    AdminUserSerializer,
    PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer,
)
from .models import UserProfile
from . import password_reset


def is_admin(user):
    """管理者かどうかをチェック"""
    try:
        return user.profile.role == 'admin'
    except UserProfile.DoesNotExist:
        return False


class RegisterView(generics.CreateAPIView):
    """ユーザー登録"""
    queryset = User.objects.all()
    permission_classes = [AllowAny]
    serializer_class = UserRegistrationSerializer
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response({
            'user': UserSerializer(user).data,
            'message': 'ユーザー登録が完了しました。'
        }, status=status.HTTP_201_CREATED)


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def current_user(request):
    """現在のユーザー情報を取得・更新"""
    if request.method == 'GET':
        serializer = UserSerializer(request.user)
        return Response(serializer.data)
    elif request.method == 'PATCH':
        serializer = UserUpdateSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            # 更新後のユーザー情報を返す
            user_serializer = UserSerializer(request.user)
            return Response(user_serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def update_display_mode(request):
    """表示モードを切り替え"""
    profile, created = UserProfile.objects.get_or_create(user=request.user)
    
    display_mode = request.data.get('display_mode')
    if display_mode not in ['business', 'parent']:
        return Response(
            {'error': '無効な表示モードです。business または parent を指定してください。'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    profile.display_mode = display_mode
    profile.save()
    
    serializer = UserProfileSerializer(profile)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def change_password(request):
    """パスワード変更"""
    serializer = PasswordChangeSerializer(data=request.data)
    if serializer.is_valid():
        user = request.user
        user.set_password(serializer.validated_data['password'])
        user.save()
        # セッションを更新してログアウトを防ぐ
        update_session_auth_hash(request, user)
        return Response({'message': 'パスワードが正常に変更されました。'}, status=status.HTTP_200_OK)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def deactivate_account(request):
    """退会処理（論理削除）"""
    profile, created = UserProfile.objects.get_or_create(user=request.user)
    profile.is_active = False
    profile.save()
    
    # ユーザーも無効化
    user = request.user
    user.is_active = False
    user.save()
    
    return Response({'message': 'アカウントが無効化されました。'}, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_user_list(request):
    """管理者用：ユーザー一覧取得"""
    if not is_admin(request.user):
        return Response(
            {'error': '管理者権限が必要です。'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    users = User.objects.all().select_related('profile')
    serializer = AdminUserSerializer(users, many=True)
    return Response(serializer.data)


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def admin_user_detail(request, user_id):
    """管理者用：ユーザー詳細取得・更新"""
    if not is_admin(request.user):
        return Response(
            {'error': '管理者権限が必要です。'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return Response(
            {'error': 'ユーザーが見つかりません。'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    if request.method == 'GET':
        serializer = AdminUserSerializer(user)
        return Response(serializer.data)
    elif request.method == 'PATCH':
        serializer = AdminUserSerializer(user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


PASSWORD_RESET_REQUEST_MESSAGE = (
    'ご入力のメールアドレスが登録されている場合、パスワード再設定用のメールを送信しました。'
    'メールが届かない場合は、迷惑メールフォルダもご確認ください。'
)
PASSWORD_RESET_INVALID_LINK_MESSAGE = (
    'このリンクは無効か、有効期限が切れています。もう一度パスワード再設定をお申し込みください。'
)


@api_view(['POST'])
@permission_classes([AllowAny])
def password_reset_request(request):
    """パスワードリセット依頼：該当ユーザーにリセット用リンクをメールで送る

    登録の有無が分からないよう、メール形式が正しければ常に同じ応答を返す。
    """
    serializer = PasswordResetRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    password_reset.send_reset_emails(serializer.validated_data['email'])
    return Response({'message': PASSWORD_RESET_REQUEST_MESSAGE}, status=status.HTTP_200_OK)


password_reset_request.cls.throttle_classes = [ScopedRateThrottle]
password_reset_request.cls.throttle_scope = 'password_reset'


@api_view(['POST'])
@permission_classes([AllowAny])
def password_reset_confirm(request):
    """パスワードリセット実行：リンクが有効なら新しいパスワードを設定する

    password を省略すると、リンクの有効性だけを確認する（画面を開いたときの事前チェック用）。
    """
    data = request.data
    if 'password' not in data:
        user = password_reset.check_reset_link(data.get('uid', ''), data.get('token', ''))
        if user is None:
            return Response({'detail': PASSWORD_RESET_INVALID_LINK_MESSAGE}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'valid': True}, status=status.HTTP_200_OK)

    serializer = PasswordResetConfirmSerializer(data=data)
    serializer.is_valid(raise_exception=True)
    user = password_reset.check_reset_link(serializer.validated_data['uid'], serializer.validated_data['token'])
    if user is None:
        return Response({'detail': PASSWORD_RESET_INVALID_LINK_MESSAGE}, status=status.HTTP_400_BAD_REQUEST)

    password = serializer.validated_data['password']
    try:
        validate_password(password, user=user)
    except DjangoValidationError as exc:
        return Response({'password': list(exc.messages)}, status=status.HTTP_400_BAD_REQUEST)

    # パスワードが変わるとトークンの元になるハッシュも変わるため、同じリンクは再利用できなくなる
    user.set_password(password)
    user.save()
    return Response({'message': 'パスワードを再設定しました。新しいパスワードでログインしてください。'}, status=status.HTTP_200_OK)


password_reset_confirm.cls.throttle_classes = [ScopedRateThrottle]
password_reset_confirm.cls.throttle_scope = 'password_reset_confirm'
