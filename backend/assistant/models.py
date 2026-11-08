from django.db import models
from django.utils.translation import gettext_lazy as _


class KnowledgeArticle(models.Model):
    """База знаний ASTTA AI. ИИ отвечает покупателям только по этим статьям и по живым данным (тарифы, курс).
    «Обучить ИИ» — значит дописывать и поправлять статьи по журналу вопросов."""

    title = models.CharField(_("вопрос или тема"), max_length=200)
    answer = models.TextField(_("ответ"))
    keywords = models.CharField(_("другие слова, которыми спрашивают"), max_length=300, blank=True,
                                help_text=_("Например: доставка, сроки, когда приедет"))
    is_active = models.BooleanField(_("используется"), default=True)
    updated_at = models.DateTimeField(_("изменён"), auto_now=True)

    class Meta:
        ordering = ["title"]
        verbose_name = _("статья базы знаний")
        verbose_name_plural = _("база знаний ИИ")

    def __str__(self):
        return self.title


class AiLog(models.Model):
    """Журнал запросов к ИИ: что спросили, что ответил, сколько токенов ушло. По нему видно, чему доучить."""

    class Kind(models.TextChoices):
        ASK = "ask", _("Вопрос покупателя")
        CHAT = "chat", _("Чат на сайте")
        PHOTO = "photo", _("Фото с ценой")
        TRANSLATE = "translate", _("Перевод карточек")

    kind = models.CharField(_("тип"), max_length=16, choices=Kind.choices)
    request = models.TextField(_("запрос"))
    response = models.TextField(_("ответ"), blank=True)
    sources = models.JSONField(_("статьи базы знаний"), default=list, blank=True)
    handoff = models.BooleanField(_("передано агенту"), default=False)
    helpful = models.BooleanField(_("ответ помог"), null=True, blank=True)
    tokens = models.PositiveIntegerField(_("токены"), default=0)
    error = models.CharField(_("ошибка"), max_length=300, blank=True)
    # Обучение ИИ: команда пишет, как надо было ответить, и ответ сразу уходит в базу знаний.
    correct_answer = models.TextField(_("правильный ответ"), blank=True,
                                      help_text=_("Напишите, как надо было ответить. После сохранения ответ "
                                                  "станет статьёй базы знаний, и ИИ будет отвечать так."))
    article = models.ForeignKey(KnowledgeArticle, verbose_name=_("статья из исправления"), null=True, blank=True,
                                on_delete=models.SET_NULL, related_name="corrections")
    created_at = models.DateTimeField(_("создан"), auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = _("запрос к ИИ")
        verbose_name_plural = _("журнал ИИ")

    def __str__(self):
        return f"{self.get_kind_display()}: {self.request[:60]}"
