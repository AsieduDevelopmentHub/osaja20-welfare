import hashlib
import hmac

from v1.core.paystack_client import verify_webhook_signature


def test_verify_webhook_signature_valid():
    secret = "sk_test_secret"
    body = b'{"event":"charge.success"}'
    sig = hmac.new(secret.encode(), body, hashlib.sha512).hexdigest()

    from v1.core.config import settings

    original = settings.paystack_secret_key
    settings.paystack_secret_key = secret
    try:
        assert verify_webhook_signature(body, sig) is True
        assert verify_webhook_signature(body, "invalid") is False
    finally:
        settings.paystack_secret_key = original
