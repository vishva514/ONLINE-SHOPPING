const cartBtn = document.getElementById("cartBtn");
const cartModal = document.getElementById("cartModal");
const closeCart = document.querySelector(".closeCart");
const cartItemsContainer = document.getElementById("cartItems");
const cartCount = document.getElementById("cartCount");
const paymentSection = document.getElementById("paymentSection");
const paymentMethod = document.getElementById("paymentMethod");
const placeOrderBtn = document.getElementById("placeOrderBtn");
const totalPriceElem = document.getElementById("totalPrice");

cartBtn.addEventListener("click", async () => {
  await renderCart();
  cartModal.style.display = "block";
});

closeCart.addEventListener("click", () => {
  cartModal.style.display = "none";
  paymentSection.style.display = "none";
});

// Close modal on outside click
window.addEventListener("click", (e) => {
  if (e.target == cartModal) cartModal.style.display = "none";
});

async function renderCart() {
  cartItemsContainer.innerHTML = "";
  paymentSection.style.display = "block";
  let totalPrice = 0;

  try {
    const safeUserId = email.replace(/\./g, "_").replace(/@/g, "_");
    const userRes = await axios.get(
      `https://firestore.googleapis.com/v1/projects/online-shop-dcd05/databases/(default)/documents/users/${safeUserId}`,
      { headers: { Authorization: `Bearer ${idToken}` } }
    );

    const cartItems = userRes.data.fields.cart?.arrayValue?.values || [];
    cartCount.textContent = cartItems.length;

    cartItems.forEach((item) => {
      const fields = item.mapValue.fields;
      const productId = fields.productId.stringValue;
      const name = fields.name.stringValue;
      const price = parseInt(fields.price.integerValue);
      let quantity = parseInt(fields.quantity.integerValue);

      const subtotal = price * quantity;
      totalPrice += subtotal;

      const itemDiv = document.createElement("div");
      itemDiv.classList.add("cart-item");
      itemDiv.innerHTML = `
        <span>${name} (₹${price}) x ${quantity} = ₹<span class="itemSubtotal">${subtotal}</span></span>
        <div>
          <button class="minus">-</button>
          <button class="plus">+</button>
          <button class="remove">Remove</button>
        </div>
      `;

      const minusBtn = itemDiv.querySelector(".minus");
      const plusBtn = itemDiv.querySelector(".plus");
      const removeBtn = itemDiv.querySelector(".remove");
      const itemSubtotalElem = itemDiv.querySelector(".itemSubtotal");

      minusBtn.addEventListener("click", async () => {
        if (quantity > 1) {
          quantity--;
          itemSubtotalElem.textContent = price * quantity;
          await updateCartQuantity(productId, quantity);
          updateTotalPrice();
        }
      });

      plusBtn.addEventListener("click", async () => {
        quantity++;
        itemSubtotalElem.textContent = price * quantity;
        await updateCartQuantity(productId, quantity);
        updateTotalPrice();
      });

      removeBtn.addEventListener("click", async () => {
        await removeFromCart(productId);
        itemDiv.remove();
        updateTotalPrice();
      });

      cartItemsContainer.appendChild(itemDiv);
    });

    function updateTotalPrice() {
      const subtotals = document.querySelectorAll(".itemSubtotal");
      let total = 0;
      subtotals.forEach((el) => total += parseInt(el.textContent));
      totalPriceElem.textContent = total;
    }

    totalPriceElem.textContent = totalPrice;

  } catch (err) {
    console.error("Error fetching cart:", err);
  }
}

async function updateCartQuantity(productId, quantity) {
  const safeUserId = email.replace(/\./g, "_").replace(/@/g, "_");
  const userRes = await axios.get(
    `https://firestore.googleapis.com/v1/projects/online-shop-dcd05/databases/(default)/documents/users/${safeUserId}`,
    { headers: { Authorization: `Bearer ${idToken}` } }
  );

  let cartItems = userRes.data.fields.cart?.arrayValue?.values || [];
  const item = cartItems.find(it => it.mapValue.fields.productId.stringValue === productId);
  if (item) item.mapValue.fields.quantity.integerValue = quantity;

  await axios.patch(
    `https://firestore.googleapis.com/v1/projects/online-shop-dcd05/databases/(default)/documents/users/${safeUserId}?updateMask.fieldPaths=cart`,
    { fields: { cart: { arrayValue: { values: cartItems } } } },
    { headers: { Authorization: `Bearer ${idToken}` } }
  );
}

async function removeFromCart(productId) {
  const safeUserId = email.replace(/\./g, "_").replace(/@/g, "_");
  const userRes = await axios.get(
    `https://firestore.googleapis.com/v1/projects/online-shop-dcd05/databases/(default)/documents/users/${safeUserId}`,
    { headers: { Authorization: `Bearer ${idToken}` } }
  );

  let cartItems = userRes.data.fields.cart?.arrayValue?.values || [];
  cartItems = cartItems.filter(it => it.mapValue.fields.productId.stringValue !== productId);

  await axios.patch(
    `https://firestore.googleapis.com/v1/projects/online-shop-dcd05/databases/(default)/documents/users/${safeUserId}?updateMask.fieldPaths=cart`,
    { fields: { cart: { arrayValue: { values: cartItems } } } },
    { headers: { Authorization: `Bearer ${idToken}` } }
  );
}

// Place Order
placeOrderBtn.addEventListener("click", async () => {
  const safeUserId = email.replace(/\./g, "_").replace(/@/g, "_");
  const userRes = await axios.get(
    `https://firestore.googleapis.com/v1/projects/online-shop-dcd05/databases/(default)/documents/users/${safeUserId}`,
    { headers: { Authorization: `Bearer ${idToken}` } }
  );

  const cartItems = userRes.data.fields.cart?.arrayValue?.values || [];
  if (cartItems.length === 0) {
    alert("Cart is empty!");
    return;
  }

  const payment = paymentMethod.value;
  const orderDate = new Date().toISOString();

  await axios.post(
    `https://firestore.googleapis.com/v1/projects/online-shop-dcd05/databases/(default)/documents/orders`,
    {
      fields: {
        userName: { stringValue: name },
        userEmail: { stringValue: email },
        orderDate: { stringValue: orderDate },
        paymentMethod: { stringValue: payment },
        products: { arrayValue: { values: cartItems } },
      },
    },
    { headers: { Authorization: `Bearer ${idToken}` } }
  );

  await axios.patch(
    `https://firestore.googleapis.com/v1/projects/online-shop-dcd05/databases/(default)/documents/users/${safeUserId}?updateMask.fieldPaths=cart`,
    { fields: { cart: { arrayValue: { values: [] } } } },
    { headers: { Authorization: `Bearer ${idToken}` } }
  );

  alert("Order placed successfully!");
  cartModal.style.display = "none";
  fetchProducts(); // Refresh product list
});
