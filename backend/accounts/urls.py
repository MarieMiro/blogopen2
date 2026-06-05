from django.urls import path
from .views import (
    register, login_view, logout_view, me,
    brand_profile_get, brand_profile_update,
  
    blogger_profile_get, blogger_profile_update,
    bloggers_list, brands_list,
    blogger_public, brand_public,
    conversations_list, conversation_messages, 
    conversation_mark_read, conversation_with_profile,
    profile_avatar, product_analyze,
    deal_create, deal_respond, deals_list, deal_pending_in_conversation,
    deal_mark_done,
)

urlpatterns = [
    path("register/", register),
    path("login/", login_view),
    path("logout/", logout_view),

    path("me/", me),
    path("brand/profile/", brand_profile_get),
    path("brand/profile/update/", brand_profile_update),
    path("blogger/profile/", blogger_profile_get),
    path("blogger/profile/update/", blogger_profile_update),

    path("bloggers/", bloggers_list),
    path("bloggers/<int:profile_id>/", blogger_public),
    path("brands/", brands_list),
    path("brands/<int:profile_id>/", brand_public),

    # ===== CHAT (основные) =====
    path("chat/", conversations_list),
    path("chat/with/<int:profile_id>/", conversation_with_profile),
    path("chat/<int:conv_id>/messages/", conversation_messages),
    path("chat/<int:conv_id>/read/", conversation_mark_read),

    # ===== CHAT (алиасы под старый фронт / другой нейминг) =====
    path("conversations/", conversations_list),
    path("conversations/with/<int:profile_id>/", conversation_with_profile),
    path("conversations/<int:conv_id>/messages/", conversation_messages),
    path("conversations/<int:conv_id>/read/", conversation_mark_read),
    path("profiles/<int:profile_id>/avatar/", profile_avatar),


    path("product/analyze/", product_analyze),

    path("deals/", deals_list),
    path("deals/create/", deal_create),
    path("deals/<int:deal_id>/respond/", deal_respond),
    path("deals/in-conversation/<int:conv_id>/", deal_pending_in_conversation),
    path("deals/<int:deal_id>/done/", deal_mark_done),
    path("deals/<int:deal_id>/dispute/", deal_dispute),
]