package com.adksoftwares.nilacafe.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.text.NumberFormat
import java.util.Locale

private data class PosProduct(val id: String, val name: String, val category: String, val price: Double)
private data class CartLine(val product: PosProduct, val quantity: Int)

@Composable
fun NilaCafeApp() {
    var selectedTab by remember { mutableStateOf("POS") }
    var search by remember { mutableStateOf("") }
    var category by remember { mutableStateOf("All") }
    var cart by remember { mutableStateOf(listOf<CartLine>()) }
    val products = remember { emptyList<PosProduct>() }
    val currency = remember { NumberFormat.getCurrencyInstance(Locale("en", "LK")) }
    val total = cart.sumOf { it.product.price * it.quantity }

    Scaffold(containerColor = MaterialTheme.colorScheme.background, bottomBar = {
        NavigationBar(containerColor = Color.White) {
            listOf("POS", "Orders", "Products", "More").forEach { tab ->
                NavigationBarItem(selected = selectedTab == tab, onClick = { selectedTab = tab },
                    icon = { Icon(when(tab) { "POS" -> Icons.Default.PointOfSale; "Orders" -> Icons.Default.ReceiptLong; "Products" -> Icons.Default.Inventory2; else -> Icons.Default.GridView }, contentDescription = tab) },
                    label = { Text(tab) })
            }
        }
    }) { insets ->
        Column(Modifier.fillMaxSize().padding(insets).padding(horizontal = 20.dp)) {
            Row(Modifier.fillMaxWidth().padding(top = 18.dp, bottom = 18.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Column {
                    Text("NILA CAFE", fontSize = 12.sp, color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold, letterSpacing = 2.sp)
                    Text(if (selectedTab == "POS") "Point of Sale" else selectedTab, fontSize = 25.sp, fontWeight = FontWeight.Bold)
                }
                Surface(shape = RoundedCornerShape(50), color = Color(0xFFFFF3E6)) {
                    Row(Modifier.padding(horizontal = 12.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.CloudOff, null, tint = Color(0xFFB67B43), modifier = Modifier.size(15.dp))
                        Spacer(Modifier.width(6.dp)); Text("API not configured", fontSize = 11.sp)
                    }
                }
            }
            when(selectedTab) {
                "POS" -> {
                    OutlinedTextField(value=search, onValueChange={search=it}, modifier=Modifier.fillMaxWidth(), placeholder={Text("Search products or scan barcode")}, leadingIcon={Icon(Icons.Default.Search,null)}, singleLine=true, shape=RoundedCornerShape(14.dp))
                    Spacer(Modifier.height(12.dp))
                    Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                        listOf("All","Food","Drinks","Desserts").forEach { FilterChip(selected=category==it,onClick={category=it},label={Text(it)}) }
                    }
                    if(products.isEmpty()) EmptyCatalog()
                    else LazyVerticalGrid(columns=GridCells.Adaptive(145.dp), contentPadding=PaddingValues(vertical=14.dp), horizontalArrangement=Arrangement.spacedBy(12.dp), verticalArrangement=Arrangement.spacedBy(12.dp)) {
                        items(products.filter { (category=="All" || it.category==category) && it.name.contains(search,true) }) { product ->
                            ProductTile(product,currency) {
                                val old=cart.firstOrNull{it.product.id==product.id}
                                cart=if(old==null) cart+CartLine(product,1) else cart.map{if(it.product.id==product.id) it.copy(quantity=it.quantity+1) else it}
                            }
                        }
                    }
                    if(cart.isNotEmpty()) Surface(color=Color(0xFF17211D),shape=RoundedCornerShape(18.dp),modifier=Modifier.fillMaxWidth().padding(vertical=10.dp).clickable{selectedTab="Orders"}) {
                        Row(Modifier.padding(16.dp),horizontalArrangement=Arrangement.SpaceBetween,verticalAlignment=Alignment.CenterVertically) {
                            Column { Text("${cart.sumOf{it.quantity}} items in order",color=Color.White,fontWeight=FontWeight.SemiBold); Text("Tap to review order",color=Color(0xFFB7C9C0),fontSize=12.sp) }
                            Text(currency.format(total),color=Color.White,fontWeight=FontWeight.Bold,fontSize=18.sp)
                        }
                    }
                }
                "Orders" -> {
                    Text("Current order",fontSize=18.sp,fontWeight=FontWeight.SemiBold)
                    if(cart.isEmpty()) Text("Your cart is empty. Add products from POS.",color=MaterialTheme.colorScheme.onSurfaceVariant,modifier=Modifier.padding(top=24.dp))
                    cart.forEach { line ->
                        ListItem(headlineContent={Text(line.product.name,fontWeight=FontWeight.SemiBold)},supportingContent={Text("${line.quantity} × ${currency.format(line.product.price)}")},trailingContent={
                            Row(verticalAlignment=Alignment.CenterVertically) {
                                IconButton(onClick={cart=cart.mapNotNull{if(it.product.id!=line.product.id)it else if(it.quantity<=1)null else it.copy(quantity=it.quantity-1)}}){Icon(Icons.Default.Remove,"Decrease")}
                                IconButton(onClick={cart=cart.map{if(it.product.id==line.product.id)it.copy(quantity=it.quantity+1)else it}}){Icon(Icons.Default.Add,"Increase")}
                            }
                        }); HorizontalDivider()
                    }
                    Spacer(Modifier.height(18.dp)); Text("Total  ${currency.format(total)}",fontSize=22.sp,fontWeight=FontWeight.Bold)
                    Button(onClick={},enabled=false,modifier=Modifier.fillMaxWidth().padding(top=12.dp)){Text("Checkout")}
                    Text("Checkout will be enabled after connecting the live API and payment flow.",color=MaterialTheme.colorScheme.onSurfaceVariant,fontSize=12.sp,modifier=Modifier.padding(top=8.dp))
                }
                else -> EmptyModule(selectedTab)
            }
        }
    }
}
@Composable private fun EmptyCatalog() {
    Column(Modifier.fillMaxWidth().padding(top=58.dp),horizontalAlignment=Alignment.CenterHorizontally) {
        Surface(shape=RoundedCornerShape(22.dp),color=Color(0xFFE8F3EE),modifier=Modifier.size(76.dp)){Box(contentAlignment=Alignment.Center){Icon(Icons.Default.Inventory2,null,tint=MaterialTheme.colorScheme.primary,modifier=Modifier.size(34.dp))}}
        Spacer(Modifier.height(16.dp)); Text("Your product catalogue will appear here",fontWeight=FontWeight.SemiBold)
        Text("Connect the cafe API to load live products and stock.",color=MaterialTheme.colorScheme.onSurfaceVariant,fontSize=13.sp)
    }
}
@Composable private fun ProductTile(product:PosProduct,currency:NumberFormat,onAdd:()->Unit) {
    Surface(shape=RoundedCornerShape(16.dp),color=Color.White,tonalElevation=1.dp,modifier=Modifier.clickable(onClick=onAdd)) {
        Column(Modifier.padding(14.dp)) {
            Surface(shape=RoundedCornerShape(12.dp),color=Color(0xFFE8F3EE),modifier=Modifier.fillMaxWidth().height(82.dp)){Box(contentAlignment=Alignment.Center){Icon(Icons.Default.LocalCafe,null,tint=MaterialTheme.colorScheme.primary,modifier=Modifier.size(32.dp))}}
            Spacer(Modifier.height(10.dp)); Text(product.name,fontWeight=FontWeight.SemiBold,maxLines=1); Text(product.category,color=MaterialTheme.colorScheme.onSurfaceVariant,fontSize=12.sp)
            Spacer(Modifier.height(8.dp)); Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween,verticalAlignment=Alignment.CenterVertically){Text(currency.format(product.price),fontWeight=FontWeight.Bold);Icon(Icons.Default.AddCircle,null,tint=MaterialTheme.colorScheme.primary)}
        }
    }
}
@Composable private fun EmptyModule(title:String) {
    Column(Modifier.fillMaxSize(),horizontalAlignment=Alignment.CenterHorizontally,verticalArrangement=Arrangement.Center) {
        Icon(Icons.Default.Construction,null,tint=MaterialTheme.colorScheme.primary,modifier=Modifier.size(42.dp)); Spacer(Modifier.height(12.dp))
        Text("$title is being connected",fontWeight=FontWeight.SemiBold,fontSize=18.sp); Text("This module will use the existing Nila Cafe services.",color=MaterialTheme.colorScheme.onSurfaceVariant,fontSize=13.sp)
    }
}
