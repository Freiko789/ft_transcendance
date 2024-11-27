import json
import logging
import requests
from django.http import JsonResponse
from django.contrib.auth.models import User
from django.contrib.auth import authenticate, login
from django.views.decorators.csrf import ensure_csrf_cookie
from django.shortcuts import render
from django.middleware.csrf import get_token
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import IntegrityError
from django.shortcuts import redirect
from rest_framework import viewsets, status
from .serializers import CustomUserSerializer
logger = logging.getLogger(__name__)
from django.utils import timezone
from django.contrib.auth import get_user_model
from .models import CustomUser, Friendship, FriendRequest, MatchHistory, BlockedUser
from django.contrib.auth.hashers import check_password, make_password
from django.views.decorators.http import require_GET
from django.conf import settings
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from django.views.decorators.http import require_http_methods
from .serializers import FriendshipSerializer
from django.core.exceptions import ValidationError
from django.core.files.images import get_image_dimensions
from django.core.validators import validate_email
from PIL import Image
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.decorators import login_required
import base64
import os
from django.core.files.base import ContentFile
from django.http import HttpResponse
# from rest_framework.authentication import JWTAuthentication


User = get_user_model()

def create_user(request):
	if request.method == 'POST':
		data = json.loads(request.body)

		user = User.create_user(data['username'], data=data['password'])
		return JsonResponse({'message': 'user created with id ' + str(user.id)}, status=201)
	else:
		return JsonResponse({'error': 'invalid request'}, status=400)

def index(request, path=''):
	return render(request, 'index.html')

@permission_classes([IsAuthenticated])
class CustomUserViewSet(viewsets.ModelViewSet):
    queryset = CustomUser.objects.all()
    serializer_class = CustomUserSerializer

    @action(detail=False, methods=['put'], url_path='display_name/(?P<display_name>[^/.]+)/update_stats')
    def update_stats_by_display_name(self, request, display_name=None):
        user = CustomUser.objects.get(display_name=display_name)
        data = request.data

        user.is_online = data.get('is_online', user.is_online)
        user.wins = data.get('wins', user.wins)
        user.losses = data.get('losses', user.losses)
        user.save()

        serializer = self.get_serializer(user)
        return Response(serializer.data, status=status.HTTP_200_OK)

@ensure_csrf_cookie
def login_view(request):
	if request.method == 'POST':
		try:
			data = json.loads(request.body)
			username = data.get('username')
			password = data.get('password')

			user = authenticate(request, username=username, password=password)
			if user is not None:
				login(request, user)

				refresh = RefreshToken.for_user(user)

				return JsonResponse({
					'success': True,
					'message': 'Connection successful',
					'access': str(refresh.access_token),
					'refresh': str(refresh),
					'username': user.username,
					'display_name': user.display_name,
					'avatar_url': user.avatar_url,
				}, status=200)
			else:
				return JsonResponse({'success': False, 'message': 'Account name or password incorrect'}, status=401)
		except json.JSONDecodeError:
			return JsonResponse({'success': False, 'message': 'Invalid JSON data'}, status=400)
		except Exception as e:
			logger.error(f"Error during connection: {str(e)}")
			return JsonResponse({'success': False, 'message': 'An error occurred'}, status=500)

	return JsonResponse({'success': False, 'message': 'Method not allowed'}, status=405)

def content(request):
	return JsonResponse({'message': 'content page'}, status=200)

@ensure_csrf_cookie
def register_view(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            username = data.get('username')
            email = data.get('email')
            password = data.get('password')
            avatar_url = data.get('avatar_url')


            if User.objects.filter(username=username).exists():
                return JsonResponse({'success': False, 'error': 'This username is already taken.'}, status=400)
            if User.objects.filter(email=email).exists():
                return JsonResponse({'success': False, 'error': 'This email is already in use.'}, status=400)

            user = User.objects.create_user(
                username=username,
                email=email,
                password=password,
                avatar_url=avatar_url,
                display_name=username,
                wins=0,
                losses=0,
                is_online=False,
            )

            refresh = RefreshToken.for_user(user)

            return JsonResponse({
                'success': True,
                'message': 'Compte créé avec succès.',
                'access': str(refresh.access_token),
                'refresh': str(refresh),
            }, status=201)

        except IntegrityError as e:
            error_message = str(e)
            if 'users_display_name_key' in error_message:
                return JsonResponse({'success': False, 'error': 'This display name is already in use.'}, status=400)
            elif 'users_email_key' in error_message:
                return JsonResponse({'success': False, 'error': 'This email is already in use.'}, status=400)
            else:
                return JsonResponse({'success': False, 'error': 'An error occurred during registration.'}, status=500)
        except Exception as e:
            logger.error(f"Error during registration: {str(e)}")
            return JsonResponse({'success': False, 'error': 'An error occurred.'}, status=500)
    return JsonResponse({'success': False, 'error': 'Method not allowed.'}, status=405)

@ensure_csrf_cookie
def set_csrf_token(request):
    token = get_token(request)
    logger.info(f"CSRF Token generated: {token}")
    return JsonResponse({'csrfToken': get_token(request)})

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def friend_requests(request):
    pass


@require_GET
@permission_classes([IsAuthenticated])
def get_user_by_display_name(request, display_name):
    try:
        user = User.objects.get(display_name=display_name)
        user_data = {
            'username': user.username,
            'email': user.email,
            'avatar_url': user.avatar_url,
            'display_name': user.display_name,
            'is_online': user.is_online,
            'wins': user.wins,
            'losses': user.losses,
        }
        return JsonResponse({'success': True, 'user': user_data})
    except User.DoesNotExist:
        logger.error(f"User not found: {display_name}")
        return JsonResponse({'success': False, 'error': 'User not found'}, status=404)
    except Exception as e:
        logger.error(f"Error fetching user by display name: {str(e)}")
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@require_http_methods(["GET"])
@permission_classes([IsAuthenticated])
def get_user_stats(request):
    user = request.user

    user_data = {
        'username': user.username,
        'email': user.email,
        'avatar_url': user.avatar_url,
        'display_name': user.display_name,
        'is_online': user.is_online,
        'wins': user.wins,
        'losses': user.losses,
    }
    return JsonResponse({'success': True, 'user': user_data})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_profile(request, display_name):
    logger.info(f"Tentative d'accès au profil de {display_name}")
    logger.info(f"Utilisateur authentifié : {request.user}")
    try:
        user = User.objects.get(display_name=display_name)
        profile_data = {
            # 'username': user.username,
            'display_name': user.display_name,
            'avatar_url': user.avatar_url,
            'wins': user.wins,
            'losses': user.losses,
            'is_online': user.is_online,
            # Ajoutez d'autres champs selon vos besoins
        }
        return JsonResponse({'success': True, 'profile': profile_data})
    except User.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'User not found'}, status=404)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_friend_request(request):
    to_username = request.data.get('to_username')
    try:
        to_user = CustomUser.objects.get(display_name=to_username)

        if request.user == to_user:
            return JsonResponse({ 'success': False,  'message': 'You cannot send a friend request to yourself.'}, status=400)

        if Friendship.objects.filter(user=request.user, friend=to_user).exists():
            return JsonResponse({'success': False, 'message': 'You are already friends with this user.'}, status=400)

        if FriendRequest.objects.filter(from_user=request.user, to_user=to_user, status='pending').exists():
            return JsonResponse({'success': False, 'message': 'A friend request is already pending for this user.'}, status=400)

        FriendRequest.objects.create(from_user=request.user, to_user=to_user)
        return JsonResponse({'success': True, 'message': 'Friend request sent'})
    except CustomUser.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'User not found'}, status=404)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def accept_friend_request(request):
    request_id = request.data.get('request_id')
    try:
        friend_request = FriendRequest.objects.get(id=request_id, to_user=request.user, status='pending')
        friend_request.status = 'accepted'
        friend_request.save()
        Friendship.objects.create(user=request.user, friend=friend_request.from_user)
        Friendship.objects.create(user=friend_request.from_user, friend=request.user)
        return JsonResponse({'success': True, 'message': 'Friend request accepted'})
    except FriendRequest.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'Friend request not found'}, status=404)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reject_friend_request(request):
    request_id = request.data.get('request_id')
    try:
        friend_request = FriendRequest.objects.get(id=request_id, to_user=request.user, status='pending')
        friend_request.status = 'rejected'
        friend_request.delete()
        return JsonResponse({'success': True, 'message': 'Friend request rejected'})
    except FriendRequest.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'Friend request not found'}, status=404)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_friend_requests(request):
    friend_requests = FriendRequest.objects.filter(to_user=request.user, status='pending')
    requests_data = [{
        'id': fr.id,
        'from_username': fr.from_user.display_name,
        'created_at': fr.created_at
    } for fr in friend_requests]
    return JsonResponse({'success': True, 'friend_requests': requests_data})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_user_settings(request):
    try:
        user = request.user
        avatar_file = request.FILES.get('avatar')

        if avatar_file:
            content_dir = os.path.join('ft_trans', 'pong', 'templates', 'content', 'avatars')
            os.makedirs(content_dir, exist_ok=True)

            file_extension = os.path.splitext(avatar_file.name)[1]
            filename = f'avatar_{user.username}_{timezone.now().timestamp()}{file_extension}'
            filepath = os.path.join(content_dir, filename)

            with open(filepath, 'wb+') as destination:
                for chunk in avatar_file.chunks():
                    destination.write(chunk)

            avatar_url = f'url("/content/avatars/{filename}")'
            user.avatar_url = avatar_url

        if 'display_name' in request.data:
            user.display_name = request.data['display_name']

        if 'email' in request.data:
            user.email = request.data['email']

        user.save()

        return JsonResponse({
            'success': True,
            'message': 'Settings updated successfully',
            'avatar_url': user.avatar_url,
            'display_name': user.display_name,
            'email': user.email
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def check_friendship_status(request, username):
    try:
        target_user = CustomUser.objects.get(username=username)
        is_friend = Friendship.objects.filter(user=request.user, friend=target_user).exists()
        request_sent = FriendRequest.objects.filter(
            from_user=request.user,
            to_user=target_user,
            status='pending'
        ).exists()

        return JsonResponse({
            'is_friend': is_friend,
            'request_sent': request_sent
        })
    except CustomUser.DoesNotExist:
        return JsonResponse({'error': 'User not found'}, status=404)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def verify_token(request):
    return JsonResponse({'success': True, 'message': 'Token valide'})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_friend_list(request):
    friendships = Friendship.objects.filter(user=request.user)
    blocked_users = BlockedUser.objects.filter(user=request.user).values_list('blocked_user__display_name', flat=True)
    friends_data = []
    for friendship in friendships:
        friend = friendship.friend
        friends_data.append({
            'display_name': friend.display_name,
            'is_online': friend.is_online,
            'avatar_url': friend.avatar_url,
            'is_blocked': friend.display_name in blocked_users
        })
    return JsonResponse({'friends': friends_data})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_online_status(request):
    user = request.user
    data = request.data
    user.is_online = data.get('is_online', user.is_online)
    user.last_activity = timezone.now()
    user.save()
    return Response({'status': 'success'})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def check_friend_request(request, username):
    try:
        target_user = CustomUser.objects.get(username=username)
        is_friend = Friendship.objects.filter(user=request.user, friend=target_user).exists()
        request_sent = FriendRequest.objects.filter(
            from_user=request.user,
            to_user=target_user,
            status='pending'
        ).exists()

        return JsonResponse({
            'is_friend': is_friend,
            'request_sent': request_sent
        })
    except CustomUser.DoesNotExist:
        return JsonResponse({'error': 'User not found'}, status=404)

@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_user_stats(request, display_name):
    try:
        user = CustomUser.objects.get(display_name=display_name)
        data = request.data

        user.wins = data.get('wins', user.wins)
        user.losses = data.get('losses', user.losses)
        user.is_online = data.get('is_online', user.is_online)
        user.save()

        return Response({
            'success': True,
            'message': 'User stats updated successfully',
            'user': {
                'username': user.username,
                'display_name': user.display_name,
                'wins': user.wins,
                'losses': user.losses,
                'is_online': user.is_online
            }
        }, status=status.HTTP_200_OK)
    except CustomUser.DoesNotExist:
        return Response({
            'success': False,
            'message': 'User not found'
        }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({
            'success': False,
            'message': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def save_match_result(request):
    try:
        result = request.data.get('result')
        opponent = request.data.get('opponent')

        # Validation des données
        if result not in ['win', 'loss']:
            return Response({
                'status': 'error',
                'message': 'Invalid result value. Must be "win" or "loss".'
            }, status=400)

        match = MatchHistory.objects.create(
            user=request.user,
            result=result,
            opponent=opponent
        )

        return Response({
            'status': 'success',
            'message': 'Match result saved successfully',
            'match': {
                'result': match.result,
                'opponent': match.opponent,
                'date': match.date.isoformat()
            }
        })
    except Exception as e:
        return Response({
            'status': 'error',
            'message': str(e)
        }, status=400)

@api_view(['GET'])
def get_recent_matches(request, username):
    try:
        user = CustomUser.objects.get(username=username)
        matches = MatchHistory.objects.filter(user=user).order_by('-date')[:10]

        matches_data = [{
            'result': match.result,
            'opponent': match.opponent,
            'date': match.date
        } for match in matches]

        return Response({
            'status': 'success',
            'matches': matches_data
        })
    except CustomUser.DoesNotExist:
        return Response({
            'status': 'error',
            'message': 'User not found'
        }, status=404)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def block_user(request):
    blocked_username = request.data.get('display_name')
    try:
        blocked_user = CustomUser.objects.get(display_name=blocked_username)

        # Vérifier si l'utilisateur essaie de se bloquer lui-même
        if blocked_user == request.user:
            return JsonResponse({
                'success': False,
                'message': 'You cannot block yourself'
            }, status=400)

        # Créer l'entrée de blocage
        BlockedUser.objects.get_or_create(
            user=request.user,
            blocked_user=blocked_user
        )

        return JsonResponse({
            'success': True,
            'message': f'Successfully blocked {blocked_username}'
        })
    except CustomUser.DoesNotExist:
        return JsonResponse({
            'success': False,
            'message': 'User not found'
        }, status=404)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def unblock_user(request):
    display_name = request.data.get('display_name')
    try:
        blocked_user = CustomUser.objects.get(display_name=display_name)
        # Vérifier si l'utilisateur est celui qui a bloqué
        block = BlockedUser.objects.filter(
            user=request.user,
            blocked_user=blocked_user
        ).first()

        if not block:
            return JsonResponse({
                'success': False,
                'message': 'You cannot unblock this user as you are not the one who blocked them'
            }, status=403)

        block.delete()
        return JsonResponse({
            'success': True,
            'message': f'Successfully unblocked {display_name}'
        })
    except CustomUser.DoesNotExist:
        return JsonResponse({
            'success': False,
            'message': 'User not found'
        }, status=404)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_blocked_users(request):
    blocked_users = BlockedUser.objects.filter(user=request.user)
    blocked_list = [block.blocked_user.display_name for block in blocked_users]
    return JsonResponse({
        'success': True,
        'blocked_users': blocked_list
    })

def auth_42_login(request):
    auth_url = 'https://api.intra.42.fr/oauth/authorize'
    params = {
        'client_id': settings.FT_CLIENT_ID,
        'redirect_uri': 'https://c1r4p6.42nice.fr:8080/api/auth/42/callback/',
        'response_type': 'code',
        'scope': 'public'
    }
    auth_url = f"{auth_url}?{'&'.join(f'{k}={v}' for k, v in params.items())}"
    return redirect(auth_url)

def auth_42_callback(request):
    code = request.GET.get('code')
    if not code:
        return JsonResponse({'success': False, 'error': 'No authorization code'})

    token_url = 'https://api.intra.42.fr/oauth/token'
    data = {
        'grant_type': 'authorization_code',
        'client_id': settings.FT_CLIENT_ID,
        'client_secret': settings.FT_CLIENT_SECRET,
        'code': code,
        'redirect_uri': 'https://c1r4p6.42nice.fr:8080/api/auth/42/callback/'
    }

    response = requests.post(token_url, data=data)
    if response.status_code != 200:
        return redirect('/register?error=auth_failed')

    token_data = response.json()
    access_token = token_data.get('access_token')

    user_url = 'https://api.intra.42.fr/v2/me'
    headers = {'Authorization': f'Bearer {access_token}'}
    user_response = requests.get(user_url, headers=headers)

    if user_response.status_code != 200:
        return redirect('/register?error=profile_fetch_failed')

    user_data = user_response.json()

    try:
        user = User.objects.get(email=user_data['email'])
        refresh = RefreshToken.for_user(user)
        response_data = {
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'username': user.username,
            'display_name': user.display_name,
            'avatar_url': user.avatar_url
        }
        return redirect(f'/login?auth_success=true&' + '&'.join(f'{k}={v}' for k, v in response_data.items()))
    except User.DoesNotExist:
        # Formater l'URL de l'avatar comme les autres
        avatar_url = f'url("{user_data["image"]["versions"]["small"]}")'

        user = User.objects.create_user(
            username=user_data['login'],
            email=user_data['email'],
            display_name=user_data['login'],
            avatar_url=avatar_url,
            password=None
        )

        refresh = RefreshToken.for_user(user)
        response_data = {
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'username': user.username,
            'display_name': user.display_name,
            'avatar_url': avatar_url
        }
        return redirect(f'/login?auth_success=true&' + '&'.join(f'{k}={v}' for k, v in response_data.items()))

def save_avatar_image(image_url, username):
    # Créer le dossier content s'il n'existe pas
    content_dir = os.path.join('ft_trans', 'pong', 'templates', 'content', 'avatars')
    os.makedirs(content_dir, exist_ok=True)

    # Nettoyer l'URL de l'image
    image_url = image_url.replace('url("', '').replace('")', '')

    try:
        # Télécharger l'image
        response = requests.get(image_url)
        if response.status_code == 200:
            # Créer un nom de fichier unique
            file_extension = os.path.splitext(image_url.split('/')[-1])[1]
            if not file_extension:
                file_extension = '.png'
            filename = f'avatar_{username}{file_extension}'
            filepath = os.path.join(content_dir, filename)

            # Sauvegarder l'image
            with open(filepath, 'wb') as f:
                f.write(response.content)

            # Retourner l'URL relative pour l'accès via le serveur
            return f'url("/content/avatars/{filename}")'
    except Exception as e:
        logger.error(f"Error saving avatar image: {str(e)}")
        return image_url

def serve_content(request, path):
    content_path = os.path.join('ft_trans', 'pong', 'templates', 'content', path)
    try:
        with open(content_path, 'rb') as f:
            return HttpResponse(f.read(), content_type='image/png')
    except FileNotFoundError:
        return HttpResponse(status=404)

