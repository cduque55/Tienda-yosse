import React, { useState, useEffect } from "react";
import { View, Text, TextInput, Button, FlatList, Alert, TouchableOpacity, Image, StyleSheet, Modal, ScrollView } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as SQLite from "expo-sqlite";

const db = SQLite.openDatabase("inventory.db");

export default function App() {
  const [products, setProducts] = useState([]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [cart, setCart] = useState([]);
  const [payment, setPayment] = useState("");
  const [image, setImage] = useState(null);
  const [search, setSearch] = useState("");

  const [modalVisible, setModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editStock, setEditStock] = useState("");
  const [editImage, setEditImage] = useState(null);

  const [sales, setSales] = useState([]); // historial de ventas

  // Crear tablas
  useEffect(() => {
    db.transaction(tx => {
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS products (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT,
          price REAL,
          stock INTEGER,
          image TEXT
        );`
      );
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS sales (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          products TEXT,
          total REAL,
          datetime TEXT
        );`
      );
    });
    loadProducts();
    loadSales();
  }, []);

  const loadProducts = () => {
    db.transaction(tx => {
      tx.executeSql("SELECT * FROM products", [], (_, { rows }) => setProducts(rows._array));
    });
  };

  const loadSales = () => {
    db.transaction(tx => {
      tx.executeSql("SELECT * FROM sales ORDER BY id DESC", [], (_, { rows }) => setSales(rows._array));
    });
  };

  // Pedir permisos de galería
  const requestPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permiso necesario", "Se requiere acceso a la galería para seleccionar imágenes");
    }
  };

  // Seleccionar imagen
  const pickImage = async (isEdit = false) => {
    await requestPermission();
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const uri = result.assets[0].uri;
      if (isEdit) setEditImage(uri);
      else setImage(uri);
    }
  };

  // Agregar producto
  const addProduct = () => {
    if (!name || !price || !stock) { Alert.alert("Error", "Completa todos los campos"); return; }
    db.transaction(tx => {
      tx.executeSql(
        "INSERT INTO products (name, price, stock, image) values (?, ?, ?, ?)",
        [name, parseFloat(price), parseInt(stock), image],
        (_, result) => loadProducts()
      );
    });
    setName(""); setPrice(""); setStock(""); setImage(null);
  };

  // Editar producto
  const startEditProduct = (product) => {
    setEditingProduct(product);
    setEditName(product.name);
    setEditPrice(product.price.toString());
    setEditStock(product.stock.toString());
    setEditImage(product.image);
    setModalVisible(true);
  };

  const saveEditProduct = () => {
    db.transaction(tx => {
      tx.executeSql(
        "UPDATE products SET name = ?, price = ?, stock = ?, image = ? WHERE id = ?",
        [editName, parseFloat(editPrice), parseInt(editStock), editImage, editingProduct.id],
        (_, result) => {
          loadProducts();
          setModalVisible(false);
          setEditingProduct(null);
        }
      );
    });
  };

  // Borrar producto
  const deleteProduct = (product) => {
    Alert.alert("Borrar producto", `¿Eliminar ${product.name}?`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Eliminar", onPress: () => {
        db.transaction(tx => {
          tx.executeSql("DELETE FROM products WHERE id = ?", [product.id], (_, result) => loadProducts());
        });
      }}
    ]);
  };

  // Carrito
  const addToCart = (product) => {
    if (product.stock <= 0) { Alert.alert("Sin stock", `${product.name} ya no tiene existencias`); return; }
    setCart([...cart, product]);
    db.transaction(tx => {
      tx.executeSql("UPDATE products SET stock = ? WHERE id = ?", [product.stock - 1, product.id], (_, result) => loadProducts());
    });
  };

  const getTotal = () => cart.reduce((sum, item) => sum + item.price, 0);

  // Guardar venta
  const saveSale = (cartItems) => {
    if (cartItems.length === 0) return;
    const productsString = cartItems.map(p => `${p.name}($${p.price})`).join(", ");
    const total = cartItems.reduce((sum, p) => sum + p.price, 0);
    const datetime = new Date().toLocaleString();
    db.transaction(tx => {
      tx.executeSql("INSERT INTO sales (products, total, datetime) values (?, ?, ?)", [productsString, total, datetime], (_, result) => loadSales());
    });
  };

  const calculateChange = () => {
    const total = getTotal();
    const pay = parseFloat(payment);
    if (isNaN(pay)) { Alert.alert("Error", "Ingresa con cuánto paga el cliente"); return; }
    if (pay < total) { Alert.alert("Pago insuficiente", "El cliente no dio suficiente dinero"); return; }
    const change = pay - total;
    Alert.alert("Resultado", `Total: $${total}\nPago: $${pay}\nCambio: $${change}`);
    saveSale(cart);
    setCart([]); setPayment("");
  };

  // Reiniciar inventario
  const resetInventory = () => {
    Alert.alert("Reiniciar inventario", "¿Continuar con reinicio de inventario?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Sí", onPress: () => {
        db.transaction(tx => { tx.executeSql("DELETE FROM products", [], (_, result) => loadProducts()); });
      }}
    ]);
  };

  // Borrar historial
  const resetSales = () => {
    Alert.alert("Borrar historial", "¿Deseas borrar todo el historial de ventas?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Sí", onPress: () => {
        db.transaction(tx => { tx.executeSql("DELETE FROM sales", [], (_, result) => loadSales()); });
      }}
    ]);
  };

  // Filtrar productos
  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) || p.price.toString().includes(search)
  );

  return (
    <ScrollView style={{ flex: 1, padding: 10, backgroundColor: "#f4f4f4" }}>
      <Button title="🔄 Reiniciar inventario" onPress={resetInventory} />

      <Text style={styles.title}>📦 Agregar producto</Text>
      <TextInput placeholder="Nombre" value={name} onChangeText={setName} style={styles.input} />
      <TextInput placeholder="Precio" value={price} onChangeText={setPrice} keyboardType="numeric" style={styles.input} />
      <TextInput placeholder="Stock" value={stock} onChangeText={setStock} keyboardType="numeric" style={styles.input} />
      <Button title="Seleccionar imagen" onPress={() => pickImage(false)} />
      {image && <Image source={{ uri: image }} style={{ width: 100, height: 100, marginVertical: 5 }} />}
      <Button title="Agregar producto" onPress={addProduct} />

      <Text style={styles.title}>🔍 Buscar producto</Text>
      <TextInput placeholder="Buscar por nombre o precio" value={search} onChangeText={setSearch} style={styles.input} />

      <Text style={styles.title}>📋 Inventario</Text>
      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.productItem} onPress={() => addToCart(item)}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              {item.image && <Image source={{ uri: item.image }} style={{ width: 50, height: 50, marginRight: 10 }} />}
              <View style={{ flex: 1 }}>
                <Text>{item.name} - ${item.price} (Stock: {item.stock})</Text>
              </View>
              <Button title="Editar" onPress={() => startEditProduct(item)} />
              <Button title="Borrar" color="red" onPress={() => deleteProduct(item)} />
            </View>
          </TouchableOpacity>
        )}
      />

      <Text style={styles.title}>🛒 Carrito</Text>
      <FlatList
        data={cart}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({ item }) => <Text>{item.name} - ${item.price}</Text>}
      />
      <Text style={{ fontSize: 18, marginVertical: 5 }}>Total: ${getTotal()}</Text>
      <TextInput
        placeholder="Con cuánto paga el cliente"
        value={payment}
        onChangeText={setPayment}
        keyboardType="numeric"
        style={styles.input}
      />
      <Button title="Calcular cambio" onPress={calculateChange} />

      <Text style={styles.title}>🧾 Historial de ventas</Text>
      <Button title="Borrar historial" onPress={resetSales} color="red" />
      <FlatList
        data={sales}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={{ padding: 5, borderBottomWidth: 1, backgroundColor: "#d0f0d0" }}>
            <Text>{item.datetime}</Text>
            <Text>{item.products}</Text>
            <Text>Total: ${item.total}</Text>
          </View>
        )}
      />

      {/* Modal de edición */}
      <Modal visible={modalVisible} animationType="slide">
        <ScrollView style={{ flex: 1, padding: 10 }}>
          <Text style={styles.title}>✏️ Editar producto</Text>
          <TextInput placeholder="Nombre" value={editName} onChangeText={setEditName} style={styles.input} />
          <TextInput placeholder="Precio" value={editPrice} onChangeText={setEditPrice} keyboardType="numeric" style={styles.input} />
          <TextInput placeholder="Stock" value={editStock} onChangeText={setEditStock} keyboardType="numeric" style={styles.input} />
          <Button title="Seleccionar nueva imagen" onPress={() => pickImage(true)} />
          {editImage && <Image source={{ uri: editImage }} style={{ width: 100, height: 100, marginVertical: 5 }} />}
          <Button title="Guardar cambios" onPress={saveEditProduct} />
          <Button title="Cancelar" color="red" onPress={() => setModalVisible(false)} />
        </ScrollView>
      </Modal>