from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.contrib.auth.models import User
from django.contrib.auth import update_session_auth_hash
from .serializers import (
    UserRegistrationSerializer, 
    UserSerializer, 
    UserProfileSerializer,
    UserUpdateSerializer,
    PasswordChangeSerializer,
    AdminUserSerializer
)
from .models import UserProfile


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
