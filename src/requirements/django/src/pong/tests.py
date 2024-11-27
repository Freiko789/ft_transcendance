from django.test import TestCase, Client
from django.urls import reverse
from django.contrib.auth.models import User
import json

class ViewsTestCase(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(username='testuser', password='12345')

    def test_create_user(self):
        url = reverse('create_user')
        data = {
            'username': 'newuser',
            'password': 'newpassword'
        }
        response = self.client.post(url, json.dumps(data), content_type='application/json')
        self.assertEqual(response.status_code, 201)

    def test_login_view(self):
        url = reverse('login')
        data = {
            'username': 'testuser',
            'password': '12345'
        }
        response = self.client.post(url, json.dumps(data), content_type='application/json')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(json.loads(response.content)['success'])

    def test_register_view(self):
        url = reverse('register')
        data = {
            'username': 'newuser',
            'email': 'newuser@example.com',
            'password': 'newpassword',
            'avatar_url': 'http://example.com/avatar.jpg'
        }
        response = self.client.post(url, json.dumps(data), content_type='application/json')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(json.loads(response.content)['success'])

    # Ajoutez d'autres tests selon vos besoins
