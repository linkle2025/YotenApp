from rest_framework import serializers
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from .models import UserProfile


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = (
            'role', 'display_mode', 'is_active', 'gender',
            'birth_year', 'birth_month', 'birth_day',
            'birth_hour', 'birth_minute', 'hour_unknown', 'prefecture',
            'residence_prefecture'
        )
        read_only_fields = ('role', 'is_active')


class AdminUserProfileSerializer(serializers.ModelSerializer):
    """管理者用プロフィールシリアライザー（ロール変更可能）"""
    class Meta:
        model = UserProfile
        fields = (
            'role', 'display_mode', 'is_active', 'gender',
            'birth_year', 'birth_month', 'birth_day',
            'birth_hour', 'birth_minute', 'hour_unknown', 'prefecture',
            'residence_prefecture'
        )


class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True, required=True, label='確認用パスワード')
    display_mode = serializers.ChoiceField(
        choices=UserProfile.DISPLAY_MODE_CHOICES,
        default='business',
        write_only=True,
        required=False
    )
    birth_year = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    birth_month = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    birth_day = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    birth_hour = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    birth_minute = serializers.IntegerField(write_only=True, required=False, allow_null=True, default=0)
    hour_unknown = serializers.BooleanField(write_only=True, required=False, default=False)
    prefecture = serializers.CharField(write_only=True, required=False, allow_null=True, allow_blank=True, max_length=10)
    residence_prefecture = serializers.CharField(write_only=True, required=False, allow_null=True, allow_blank=True, max_length=10)
    gender = serializers.ChoiceField(choices=UserProfile.GENDER_CHOICES, default='male', write_only=True, required=False)
    
    class Meta:
        model = User
        fields = (
            'username', 'email', 'password', 'password2',
            'display_mode', 'gender', 'birth_year', 'birth_month', 'birth_day',
            'birth_hour', 'birth_minute', 'hour_unknown', 'prefecture',
            'residence_prefecture'
        )
        extra_kwargs = {
            'email': {'required': True}
        }
    
    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError({"password": "パスワードが一致しません。"})
        return attrs
    
    def create(self, validated_data):
        # プロフィール情報を取得
        profile_data = {
            'display_mode': validated_data.pop('display_mode', 'business'),
            'gender': validated_data.pop('gender', 'male'),
            'birth_year': validated_data.pop('birth_year', None),
            'birth_month': validated_data.pop('birth_month', None),
            'birth_day': validated_data.pop('birth_day', None),
            'birth_hour': validated_data.pop('birth_hour', None),
            'birth_minute': validated_data.pop('birth_minute', 0),
            'hour_unknown': validated_data.pop('hour_unknown', False),
            'prefecture': validated_data.pop('prefecture', None),
            'residence_prefecture': validated_data.pop('residence_prefecture', None),
        }
        
        validated_data.pop('password2')
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password']
        )
        
        # プロフィール情報を更新
        profile = user.profile
        for key, value in profile_data.items():
            setattr(profile, key, value)
        profile.save()
        
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    """ユーザー情報更新用シリアライザー"""
    profile = UserProfileSerializer(required=False)
    
    class Meta:
        model = User
        fields = ('username', 'email', 'profile')
    
    def validate_username(self, value):
        # ユーザー名の重複チェック（自分自身は除外）
        if User.objects.filter(username=value).exclude(pk=self.instance.pk).exists():
            raise serializers.ValidationError("このユーザー名は既に使用されています。")
        return value
    
    def update(self, instance, validated_data):
        profile_data = validated_data.pop('profile', None)
        
        # ユーザー情報を更新
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # プロフィール情報を更新
        if profile_data:
            profile = instance.profile
            for attr, value in profile_data.items():
                setattr(profile, attr, value)
            profile.save()
        
        return instance


class PasswordChangeSerializer(serializers.Serializer):
    """パスワード変更用シリアライザー"""
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password], label='新しいパスワード')
    password2 = serializers.CharField(write_only=True, required=True, label='確認用パスワード')
    
    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError({"password": "パスワードが一致しません。"})
        return attrs


class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(read_only=True)
    
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'date_joined', 'profile')


class AdminUserSerializer(serializers.ModelSerializer):
    """管理者用ユーザーシリアライザー"""
    profile = AdminUserProfileSerializer(required=False)
    
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'date_joined', 'is_active', 'profile')
    
    def update(self, instance, validated_data):
        profile_data = validated_data.pop('profile', None)
        
        # ユーザー情報を更新
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # プロフィール情報を更新
        if profile_data:
            profile, created = UserProfile.objects.get_or_create(user=instance)
            for attr, value in profile_data.items():
                setattr(profile, attr, value)
            profile.save()
        
        return instance

