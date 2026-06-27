package com.wanyingku.tv.data

import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

// 对接 Go 后端 /api/v1。所有方法返回统一信封，由 Repository 拆包。
interface Api {
    // ---- 公开 ----
    @GET("home")
    suspend fun home(): ApiResp<HomeData>

    @GET("titles")
    suspend fun titles(
        @Query("kind") kind: Int? = null,
        @Query("genre") genre: Long? = null,
        @Query("year") year: Int? = null,
        @Query("region") region: String? = null,
        @Query("tag") tag: String? = null,
        @Query("sort") sort: String? = null,
        @Query("adult") adult: Int? = null,
        @Query("page") page: Int = 1,
        @Query("size") size: Int = 24,
    ): ApiResp<Paged<Title>>

    @GET("titles/{id}")
    suspend fun title(@Path("id") id: Long): ApiResp<DetailResp>

    @GET("titles/{id}/related")
    suspend fun related(@Path("id") id: Long, @Query("limit") limit: Int = 12): ApiResp<List<Title>>

    @GET("titles/random")
    suspend fun random(@Query("kind") kind: Int? = null): ApiResp<Title>

    @GET("collections")
    suspend fun collections(): ApiResp<List<Collection>>

    @GET("collections/{key}")
    suspend fun collection(
        @Path("key") key: String,
        @Query("page") page: Int = 1,
        @Query("size") size: Int = 30,
    ): ApiResp<Collection>

    @GET("search")
    suspend fun search(
        @Query("q") q: String,
        @Query("kind") kind: Int? = null,
        @Query("sort") sort: String? = null,
        @Query("page") page: Int = 1,
        @Query("size") size: Int = 24,
    ): ApiResp<Paged<Title>>

    @GET("search/hot")
    suspend fun hotSearches(@Query("limit") limit: Int = 10): ApiResp<List<String>>

    @GET("tags")
    suspend fun tags(@Query("kind") kind: Int? = null): ApiResp<List<String>>

    @GET("genres")
    suspend fun genres(@Query("kind") kind: Int? = null): ApiResp<List<Genre>>

    @GET("people")
    suspend fun people(
        @Query("name") name: String,
        @Query("page") page: Int = 1,
        @Query("size") size: Int = 30,
    ): ApiResp<Paged<Title>>

    @GET("requests")
    suspend fun requests(
        @Query("status") status: Int = -1,
        @Query("page") page: Int = 1,
        @Query("size") size: Int = 24,
    ): ApiResp<Paged<RequestItem>>

    @GET("titles/{id}/comments")
    suspend fun comments(
        @Path("id") id: Long,
        @Query("page") page: Int = 1,
        @Query("size") size: Int = 20,
    ): ApiResp<Paged<Comment>>

    // ---- 鉴权 ----
    @POST("auth/login")
    suspend fun login(@Body body: LoginBody): ApiResp<AuthResult>

    @POST("auth/register")
    suspend fun register(@Body body: RegisterBody): ApiResp<AuthResult>

    @GET("me")
    suspend fun me(): ApiResp<User>

    // ---- 我的 ----
    @GET("me/favorites")
    suspend fun favorites(@Query("page") page: Int = 1, @Query("size") size: Int = 24): ApiResp<Paged<Favorite>>

    @POST("me/favorites")
    suspend fun addFavorite(@Body body: IdBody): ApiResp<Ok>

    @DELETE("me/favorites/{id}")
    suspend fun removeFavorite(@Path("id") id: Long): ApiResp<Ok>

    @GET("me/history")
    suspend fun history(@Query("page") page: Int = 1, @Query("size") size: Int = 24): ApiResp<Paged<WatchHistory>>

    @POST("me/history")
    suspend fun saveProgress(@Body body: ProgressBody): ApiResp<Ok>

    @DELETE("me/history/{id}")
    suspend fun deleteHistory(@Path("id") id: Long): ApiResp<Ok>

    @GET("me/recommend")
    suspend fun recommend(@Query("limit") limit: Int = 12): ApiResp<List<Title>>

    @GET("me/subscriptions")
    suspend fun subscriptions(@Query("page") page: Int = 1, @Query("size") size: Int = 24): ApiResp<Paged<Subscription>>

    @POST("me/subscriptions")
    suspend fun subscribe(@Body body: IdBody): ApiResp<Ok>

    @DELETE("me/subscriptions/{id}")
    suspend fun unsubscribe(@Path("id") id: Long): ApiResp<Ok>

    @GET("me/notifications")
    suspend fun notifications(@Query("page") page: Int = 1, @Query("size") size: Int = 24): ApiResp<Paged<Notification>>

    @GET("me/notifications/unread")
    suspend fun unread(): ApiResp<UnreadResp>

    @POST("me/notifications/{id}/read")
    suspend fun markRead(@Path("id") id: Long): ApiResp<Ok>

    @POST("me/notifications/read-all")
    suspend fun markAllRead(): ApiResp<Ok>

    @GET("me/requests")
    suspend fun myRequests(@Query("page") page: Int = 1, @Query("size") size: Int = 24): ApiResp<Paged<RequestItem>>

    // ---- 互动 ----
    @POST("requests")
    suspend fun createRequest(@Body body: NewRequestBody): ApiResp<RequestItem>

    @POST("requests/{id}/vote")
    suspend fun vote(@Path("id") id: Long): ApiResp<VoteResp>

    @DELETE("requests/{id}/vote")
    suspend fun unvote(@Path("id") id: Long): ApiResp<VoteResp>

    @POST("comments")
    suspend fun addComment(@Body body: CommentBody): ApiResp<Comment>

    @DELETE("comments/{id}")
    suspend fun deleteComment(@Path("id") id: Long): ApiResp<Ok>

    @POST("comments/{id}/like")
    suspend fun likeComment(@Path("id") id: Long): ApiResp<Ok>

    @DELETE("comments/{id}/like")
    suspend fun unlikeComment(@Path("id") id: Long): ApiResp<Ok>

    @POST("titles/{id}/like")
    suspend fun likeTitle(@Path("id") id: Long): ApiResp<Ok>

    @DELETE("titles/{id}/like")
    suspend fun unlikeTitle(@Path("id") id: Long): ApiResp<Ok>

    @POST("titles/{id}/skip")
    suspend fun submitSkip(@Path("id") id: Long, @Body body: SkipBody): ApiResp<Ok>
}
