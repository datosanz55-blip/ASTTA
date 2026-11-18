import pytest
from django.contrib.admin.sites import AdminSite
from django.test import Client, RequestFactory
from django.utils import timezone

from accounts.models import User
from catalog.admin import CustomerReviewAdmin
from catalog.models import CustomerReview

pytestmark = pytest.mark.django_db
BODY = {"rating": 5, "text": "Заказ пришёл, всё понравилось", "consent": True}


def signed_client():
    buyer = User.objects.create_user(username="reviewer", first_name="Анна", email="private@example.com",
                                     phone="+79990000000", telegram_id=12345)
    client = Client()
    client.force_login(buyer)
    return client, buyer


def test_pending_reviews_are_private_until_published():
    client, buyer = signed_client()
    response = client.post('/api/reviews', BODY, content_type='application/json')
    assert response.status_code == 201
    review = CustomerReview.objects.get()
    assert review.user == buyer and review.status == 'pending' and review.consent_at
    assert Client().get('/api/reviews').json() == {
        'items': [], 'total': 0, 'average': None, 'page': 1, 'has_more': False}
    review.status = 'published'
    review.save()
    public = Client().get('/api/reviews').json()
    assert public['total'] == 1 and public['average'] == 5
    assert public['items'][0]['author'] == 'Анна'
    assert set(public['items'][0]) == {'id', 'author', 'rating', 'text', 'created_at'}
    assert 'private@example.com' not in str(public) and '12345' not in str(public)
    review.status = 'rejected'
    review.save()
    assert Client().get('/api/reviews').json()['total'] == 0


def test_guest_staff_and_csrf():
    assert Client().post('/api/reviews', BODY, content_type='application/json').status_code == 401
    client, buyer = signed_client()
    buyer.is_staff = True
    buyer.save()
    assert client.post('/api/reviews', BODY, content_type='application/json').status_code == 401
    buyer.is_staff = False
    buyer.save()
    protected = Client(enforce_csrf_checks=True)
    protected.force_login(buyer)
    assert protected.post('/api/reviews', BODY, content_type='application/json').status_code == 403
    token = protected.get('/api/auth/csrf').json()['csrf']
    response = protected.post('/api/reviews', BODY, content_type='application/json', HTTP_X_CSRFTOKEN=token)
    assert response.status_code == 201


@pytest.mark.parametrize('change', [{'rating': 0}, {'rating': 6}, {'rating': 2.5}, {'text': ' ' * 20},
                                   {'text': 'коротко'}, {'text': 'a' * 2001}, {'consent': False}])
def test_validation(change):
    client, _ = signed_client()
    assert client.post('/api/reviews', {**BODY, **change}, content_type='application/json').status_code == 422
    assert not CustomerReview.objects.exists()


def test_duplicate_and_daily_limit():
    client, _ = signed_client()
    assert client.post('/api/reviews', BODY, content_type='application/json').status_code == 201
    assert client.post('/api/reviews', BODY, content_type='application/json').status_code == 409
    for n in range(2):
        assert client.post('/api/reviews', {**BODY, 'text': BODY['text'] + str(n)},
                           content_type='application/json').status_code == 201
    assert client.post('/api/reviews', {**BODY, 'text': 'Другой честный отзыв'},
                       content_type='application/json').status_code == 429
    assert CustomerReview.objects.count() == 3


def test_pagination_average_and_admin_moderation():
    _, buyer = signed_client()
    reviews = [CustomerReview.objects.create(user=buyer, rating=1 if n == 0 else 5, text=str(n),
                                             consent_at=timezone.now(), status='published') for n in range(7)]
    CustomerReview.objects.create(user=buyer, rating=1, text='pending', consent_at=timezone.now())
    client = Client()
    first, second = client.get('/api/reviews').json(), client.get('/api/reviews?page=2').json()
    assert len(first['items']) == 6 and first['has_more']
    assert len(second['items']) == 1 and not second['has_more']
    assert first['average'] == 4.4 and first['total'] == 7
    assert set(r['id'] for r in first['items']).isdisjoint(r['id'] for r in second['items'])
    assert client.get('/api/reviews?page=0').status_code == 422
    admin = CustomerReviewAdmin(CustomerReview, AdminSite())
    admin.message_user = lambda *args, **kwargs: None
    request = RequestFactory().get('/')
    assert not admin.has_add_permission(request)
    admin.hide_reviews(request, CustomerReview.objects.filter(pk=reviews[0].pk))
    assert client.get('/api/reviews').json()['average'] == 5
    admin.publish_reviews(request, CustomerReview.objects.filter(status='pending'))
    assert client.get('/api/reviews').json()['total'] == 7
