from ninja.throttling import AnonRateThrottle


def per_ip(scope: str, rate: str) -> AnonRateThrottle:
    """Лимит запросов с одного адреса со своим счётчиком.

    У AnonRateThrottle по умолчанию один счётчик на всё API: лимиты разных ручек мешали бы друг другу
    (десять поисков по ссылке закрывали бы вход в кабинет, а минутный лимит стирал бы дневной).
    """
    throttle = AnonRateThrottle(rate)
    throttle.scope = scope
    return throttle
