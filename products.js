
const idToken = sessionStorage.getItem("idToken");
const name = sessionStorage.getItem("displayName");
const email = sessionStorage.getItem("email");
const role = sessionStorage.getItem("role");

if (!idToken) {
  window.location.href = "index.html";
} else {
  document.getElementById("userInfo").innerHTML = `
    <p><strong>Name:</strong> ${name}</p>
    <p><strong>Email:</strong> ${email}</p>
  `;
}

document.getElementById("logoutBtn").addEventListener("click", () => {
  sessionStorage.clear();
  window.location.href = "index.html";
});

const showFormBtn = document.getElementById("showAdminFormBtn");
const adminFormContainer = document.getElementById("adminFormContainer");

if (role === "admin") {

  showFormBtn.style.display = "inline-block";
  showFormBtn.addEventListener("click", () => {
    adminFormContainer.style.display =
      adminFormContainer.style.display === "none" ? "block" : "none";
  });

  const adminForm = document.getElementById("adminProductForm");
  adminForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("productName").value;
    const description = document.getElementById("productDescription").value;
    const price = document.getElementById("productPrice").value;
    const quantity = document.getElementById("productQuantity").value;

    try {
      await axios.post(
        `https://firestore.googleapis.com/v1/projects/online-shop-dcd05/databases/(default)/documents/shoppingProducts`,
        {
          fields: {
            name: { stringValue: name },
            description: { stringValue: description },
            price: { integerValue: parseInt(price) },
            quantity: { integerValue: parseInt(quantity) },
          },
        },
        { headers: { Authorization: `Bearer ${idToken}` } }
      );

      alert("Product added successfully!");
      adminForm.reset();
      fetchProducts();
    } catch (err) {
      console.error("Error adding product:", err.response?.data || err);
      alert("Failed to add product.");
    }
  });
}

async function fetchProducts() {
  const container = document.getElementById("productsContainer");
  container.innerHTML = "";

  try {
    const res = await axios.get(
      "https://firestore.googleapis.com/v1/projects/online-shop-dcd05/databases/(default)/documents/shoppingProducts",
      { headers: { Authorization: `Bearer ${idToken}` } }
    );

    const products = res.data.documents || [];

    products.forEach((productDoc) => {
      const fields = productDoc.fields || {};
      const productId = productDoc.name.split("/").pop();

      const productName = fields.name?.stringValue || "Unnamed Product";
      const productDescription = fields.description?.stringValue || "";
      const productPrice =
        fields.price?.integerValue || fields.price?.doubleValue || "N/A";
      const productQty = fields.quantity?.integerValue || 0;

      const productBox = document.createElement("div");
      productBox.classList.add("product-box");

      productBox.innerHTML = `
        <h3>${productName}</h3>
        <p>${productDescription}</p>
        <p>Price: ₹${productPrice}</p>
        <p>Available: ${productQty}</p>
      `;

      if (role === "admin") {
        const deleteBtn = document.createElement("button");
        deleteBtn.textContent = "Delete";
        deleteBtn.addEventListener("click", async () => {
          try {
            await axios.delete(
              `https://firestore.googleapis.com/v1/projects/online-shop-dcd05/databases/(default)/documents/shoppingProducts/${productId}`,
              { headers: { Authorization: `Bearer ${idToken}` } }
            );
            productBox.remove();
            alert("Product deleted successfully!");
          } catch (err) {
            console.error("Error deleting product:", err.response?.data || err);
            alert("Failed to delete product.");
          }
        });

        const editBtn = document.createElement("button");
        editBtn.textContent = "Edit";
        editBtn.addEventListener("click", () => {
          openEditForm(productId, productName, productDescription, productPrice, productQty);
        });

        productBox.appendChild(editBtn);
        productBox.appendChild(deleteBtn);
      } else {
        const qtyContainer = document.createElement("div");
        qtyContainer.classList.add("quantity-control");

        const minusBtn = document.createElement("button");
        minusBtn.textContent = "-";
        const qtyDisplay = document.createElement("span");
        qtyDisplay.textContent = "1";
        const plusBtn = document.createElement("button");
        plusBtn.textContent = "+";

        qtyContainer.appendChild(minusBtn);
        qtyContainer.appendChild(qtyDisplay);
        qtyContainer.appendChild(plusBtn);
        productBox.appendChild(qtyContainer);

        let selectedQty = 1;

        minusBtn.addEventListener("click", () => {
          if (selectedQty > 1) {
            selectedQty--;
            qtyDisplay.textContent = selectedQty;
          }
        });

        plusBtn.addEventListener("click", () => {
          if (selectedQty < productQty) {
            selectedQty++;
            qtyDisplay.textContent = selectedQty;
          }
        });

        const addToCartBtn = document.createElement("button");
        addToCartBtn.textContent = "Add to Cart";
     if (productQty == 0) {
  addToCartBtn.style.cursor = "not-allowed";
  addToCartBtn.disabled = true;
  addToCartBtn.style.textContent = "Out of Stock";
  addToCartBtn.style.backgroundColor="#aba1a1ff";
}

        addToCartBtn.addEventListener("click", () =>
          addToCart(productId, productName, productPrice, selectedQty)
        );
        productBox.appendChild(addToCartBtn);
      }

      container.appendChild(productBox);
    });
  } catch (err) {
    console.error("Error fetching products:", err.response?.data || err);
  }
}


async function addToCart(productId, productName, productPrice, selectedQty) {
  try {
    const safeUserId = email.replace(/\./g, "_").replace(/@/g, "_");

    // Fetch product details first
    const productRes = await axios.get(
      `https://firestore.googleapis.com/v1/projects/online-shop-dcd05/databases/(default)/documents/shoppingProducts/${productId}`,
      { headers: { Authorization: `Bearer ${idToken}` } }
    );

    const productDoc = productRes.data;
    let availableQty = parseInt(productDoc.fields.quantity?.integerValue || 0);

    if (availableQty < selectedQty) {
      alert("Sorry, not enough stock available!");
      return;
    }

    // 🔥 Reduce stock by selected quantity
    await axios.patch(
      `https://firestore.googleapis.com/v1/projects/online-shop-dcd05/databases/(default)/documents/shoppingProducts/${productId}?updateMask.fieldPaths=quantity`,
      {
        fields: {
          quantity: { integerValue: availableQty - selectedQty },
        },
      },
      { headers: { Authorization: `Bearer ${idToken}` } }
    );


    const userRes = await axios.get(
      `https://firestore.googleapis.com/v1/projects/online-shop-dcd05/databases/(default)/documents/users/${safeUserId}`,
      { headers: { Authorization: `Bearer ${idToken}` } }
    );

    const userDoc = userRes.data;
    let currentItems = userDoc.fields.cart?.arrayValue?.values || [];

    const existingItem = currentItems.find(
      (item) => item.mapValue.fields.productId.stringValue === productId
    );

    if (existingItem) {
      existingItem.mapValue.fields.quantity.integerValue =
        parseInt(existingItem.mapValue.fields.quantity.integerValue) + selectedQty;
    } else {
      currentItems.push({
        mapValue: {
          fields: {
            productId: { stringValue: productId },
            name: { stringValue: productName },
            price: { integerValue: parseInt(productPrice) },
            quantity: { integerValue: selectedQty },
          },
        },
      });
    }

    await axios.patch(
      `https://firestore.googleapis.com/v1/projects/online-shop-dcd05/databases/(default)/documents/users/${safeUserId}?updateMask.fieldPaths=cart`,
      {
        fields: { cart: { arrayValue: { values: currentItems } } },
      },
      { headers: { Authorization: `Bearer ${idToken}` } }
    );

    alert("Added to cart");
    fetchProducts(); 
  } catch (err) {
    console.error("Error adding to cart:", err.response?.data || err);
    alert("Failed to add product to cart.");
  }
}

const searchInput = document.getElementById("searchInput");
searchInput.addEventListener("input", () => {
  const searchTerm = searchInput.value.toLowerCase();
  document.querySelectorAll(".product-box").forEach((box) => {
    const productName = box.querySelector("h3").textContent.toLowerCase();
    box.style.display = productName.includes(searchTerm) ? "block" : "none";
  });
});
function openEditForm(id, name, description, price, qty) {
  const container = document.createElement("div");
  container.classList.add("edit-modal");

  container.innerHTML = `
    <div class="edit-modal-content">
      <h3>Edit Product</h3>
      <form id="editForm">
        <input type="text" id="editName" value="${name}" required /><br><br>
        <textarea id="editDescription" required>${description}</textarea><br><br>
        <input type="number" id="editPrice" value="${price}" required /><br><br>
        <input type="number" id="editQty" value="${qty}" required /><br><br>
        <button type="submit">Save Changes</button>
        <button type="button" id="cancelEdit">Cancel</button>
      </form>
    </div>
  `;

  document.body.appendChild(container);

  document.getElementById("cancelEdit").addEventListener("click", () => {
    container.remove();
  });

  document.getElementById("editForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const updatedName = document.getElementById("editName").value;
    const updatedDesc = document.getElementById("editDescription").value;
    const updatedPrice = document.getElementById("editPrice").value;
    const updatedQty = document.getElementById("editQty").value;

    try {
      await axios.patch(
        `https://firestore.googleapis.com/v1/projects/online-shop-dcd05/databases/(default)/documents/shoppingProducts/${id}?updateMask.fieldPaths=name&updateMask.fieldPaths=description&updateMask.fieldPaths=price&updateMask.fieldPaths=quantity`,
        {
          fields: {
            name: { stringValue: updatedName },
            description: { stringValue: updatedDesc },
            price: { integerValue: parseInt(updatedPrice) },
            quantity: { integerValue: parseInt(updatedQty) },
          },
        },
        { headers: { Authorization: `Bearer ${idToken}` } }
      );
      alert("Product updated successfully!");
      container.remove();
      fetchProducts();
    } catch (err) {
      console.error("Error updating product:", err.response?.data || err);
      alert("Failed to update product.");
    }
  });
}
fetchProducts();
