package com.adksoftwares.nilacafe.data

import com.adksoftwares.nilacafe.BuildConfig
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST

data class LoginRequest(val email: String, val password: String)
data class SafeUser(val id: String?, val name: String?, val email: String?, val role: String?, val shop_id: String?)
data class LoginResponse(val token: String, val user: SafeUser)
data class ProductDto(
    val id: String,
    val code: String?,
    val name: String,
    val category: String?,
    val takeaway_price: Double?,
    val normal_price: Double?,
    val stock: Int?,
    val active: Boolean?
)
data class ProductsResponse(val products: List<ProductDto> = emptyList())

interface NilaCafeService {
    @POST("auth/login")
    suspend fun login(@Body request: LoginRequest): LoginResponse

    @GET("products")
    suspend fun products(@Header("Authorization") bearerToken: String): ProductsResponse
}

object NilaCafeApi {
    val service: NilaCafeService by lazy {
        val http = OkHttpClient.Builder().build()
        Retrofit.Builder()
            .baseUrl(BuildConfig.API_BASE_URL)
            .client(http)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(NilaCafeService::class.java)
    }
}
