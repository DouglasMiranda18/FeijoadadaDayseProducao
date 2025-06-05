function isValidImageUrl(url) {
    try {
        const urlObj = new URL(url);
        return true;
    } catch (error) {
        return false;
    }
}

function updateQuantity(productId, change) {
    const item = cart.find(item => item.id === productId);
    if (item) {
        item.quantity += change;
        if (item.quantity <= 0) {
            removeFromCart(productId);
        } else {
            updateCartDisplay();
            updateCartCount();
        }
    }
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    updateCartDisplay();
    updateCartCount();
}

function addToCart(product) {
    if (!product.availability) {
        showToast('Este produto está indisponível', 'error');
        return;
    }

    const existingItem = cart.find(item => item.id === product.id);
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            ...product,
            quantity: 1
        });
    }
    updateCartCount();
    updateCartDisplay();
    showToast('Item adicionado ao carrinho!');
}

const firebaseConfig = {
    apiKey: "AIzaSyC1zIakJQ0YZSFDNKl8l_K39ajNeAbRtbU",
    authDomain: "feijoadadadayse-a074d.firebaseapp.com",
    projectId: "feijoadadadayse-a074d",
    storageBucket: "feijoadadadayse-a074d.appspot.com",
    messagingSenderId: "193167774782",
    appId: "1:193167774782:web:6b32f1088a010d992ead6f",
    measurementId: "G-38FGHLE4V4"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();
const productsRef = db.collection('products');

const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const mobileMenu = document.getElementById('mobileMenu');
const adminBtn = document.getElementById('adminBtn');
const adminBtnMobile = document.getElementById('adminBtnMobile');
const adminPanel = document.getElementById('adminPanel');
const loginForm = document.getElementById('loginForm');
const productManagement = document.getElementById('productManagement');
const addProductForm = document.getElementById('addProductForm');
const editProductForm = document.getElementById('editProductForm');
const editModal = document.getElementById('editModal');
const closeEditModal = document.getElementById('closeEditModal');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const deleteModal = document.getElementById('deleteModal');
const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');
const categoryBtns = document.querySelectorAll('.category-btn');
const menuItems = document.getElementById('menu-items');
const contactForm = document.getElementById('contactForm');

mobileMenuBtn.addEventListener('click', () => {
    mobileMenu.classList.toggle('hidden');
});

adminBtn.addEventListener('click', () => {
    adminPanel.classList.toggle('admin-panel');
    window.location.href = '#adminPanel';
});

adminBtnMobile.addEventListener('click', () => {
    adminPanel.classList.toggle('admin-panel');
    mobileMenu.classList.add('hidden');
    window.location.href = '#adminPanel';
});

let currentCategory = 'all';
let allProducts = [];

function loadMenuItems() {
    menuItems.innerHTML = `
            <div class="flex justify-center items-center col-span-full py-12">
                <div class="loader"></div>
                <span class="ml-3 text-gray-600">Carregando cardápio...</span>
            </div>
        `;

    productsRef.get().then((snapshot) => {
        allProducts = [];
        snapshot.forEach((doc) => {
            allProducts.push({
                id: doc.id,
                ...doc.data()
            });
        });
        displayMenuItems();
        loadProductTable();
    }).catch((error) => {
        console.error("Error loading menu items: ", error);
        menuItems.innerHTML = `
                <div class="col-span-full text-center py-12">
                    <p class="text-red-500">Erro ao carregar o cardápio. Por favor, tente novamente mais tarde.</p>
                </div>
            `;
    });
}

function displayMenuItems() {
    if (allProducts.length === 0) {
        menuItems.innerHTML = `
                <div class="col-span-full text-center py-12">
                    <p class="text-gray-500">Nenhum item encontrado no cardápio.</p>
                </div>
            `;
        return;
    }

    let filteredProducts = allProducts;
    if (currentCategory !== 'all') {
        filteredProducts = allProducts.filter(product => product.category === currentCategory);
    }

    filteredProducts.sort((a, b) => {
        if (a.availability && !b.availability) return -1;
        if (!a.availability && b.availability) return 1;
        const aHasFeijoada = a.name.toLowerCase().includes('feijoada');
        const bHasFeijoada = b.name.toLowerCase().includes('feijoada');
        if (aHasFeijoada && !bHasFeijoada) return -1;
        if (!aHasFeijoada && bHasFeijoada) return 1;
        return a.name.localeCompare(b.name, 'pt-BR');
    });

    if (filteredProducts.length === 0) {
        menuItems.innerHTML = `
                <div class="col-span-full text-center py-12">
                    <p class="text-gray-500">Nenhum item encontrado nesta categoria.</p>
                </div>
            `;
        return;
    }

    menuItems.innerHTML = filteredProducts.map(product => `
            <div class="card bg-white rounded-lg shadow-md overflow-hidden ${!product.availability ? 'opacity-75' : ''}">
                <div class="h-48 bg-${getCategoryColor(product.category)} flex items-center justify-center relative">
                    ${product.image ? `<img src="${product.image}" alt="${product.name}" class="h-full w-full object-cover">` :
            `<svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>`}
                    ${!product.availability ? `
                    <div class="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                        <span class="text-white font-medium px-4 py-2 bg-vermelho rounded-md">Indisponível</span>
                    </div>
                    ` : ''}
                </div>
                <div class="p-4">
                    <div class="flex justify-between items-start mb-2">
                        <h3 class="text-lg font-semibold text-marrom">${product.name}</h3>
                        <span class="bg-caramelo text-white px-2 py-1 rounded-full text-sm font-medium">R$ ${product.price.toFixed(2)}</span>
                    </div>
                    <p class="text-gray-600 text-sm mb-3">${product.description}</p>
                    <div class="flex justify-between items-center">
                        <span class="text-xs text-gray-500 capitalize">${getCategoryName(product.category)}</span>
                        <button onclick="${product.availability ? `showProductDetails(${JSON.stringify({ ...product }).replace(/"/g, "'")})` : 'showToast(\'Produto indisponível\', \'error\')'}" 
                            class="${product.availability ? 'bg-vermelho hover:bg-red-800' : 'bg-gray-400 cursor-not-allowed'} text-white text-sm py-1 px-3 rounded-md transition-colors">
                            ${product.availability ? 'Adicionar' : 'Indisponível'}
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
}

function getCategoryColor(category) {
    switch (category) {
        case 'comidas': return 'marrom';
        case 'acompanhamentos': return 'caramelo';
        case 'bebidas': return 'vermelho';
        case 'sobremesas': return 'bordo';
        default: return 'marrom';
    }
}

function getCategoryName(category) {
    switch (category) {
        case 'comidas': return 'Comidas';
        case 'acompanhamentos': return 'Acompanhamentos';
        case 'bebidas': return 'Bebidas';
        case 'sobremesas': return 'Sobremesas';
        default: return category;
    }
}

categoryBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        categoryBtns.forEach(b => b.classList.remove('bg-caramelo', 'text-white'));
        categoryBtns.forEach(b => b.classList.add('bg-gray-200', 'text-gray-800'));
        btn.classList.remove('bg-gray-200', 'text-gray-800');
        btn.classList.add('bg-caramelo', 'text-white');
        currentCategory = btn.dataset.category;
        displayMenuItems();
    });
});

const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const adminEmail = document.getElementById('adminEmail');
const adminPassword = document.getElementById('adminPassword');
const loginError = document.getElementById('loginError');

loginBtn.addEventListener('click', (e) => {
    e.preventDefault();

    const email = adminEmail.value.trim();
    const password = adminPassword.value.trim();

    auth.signInWithEmailAndPassword(email, password)
        .then(() => {
            loginForm.classList.add('hidden');
            productManagement.classList.remove('hidden');
            logoutBtn.classList.remove('hidden');
            loginError.classList.add('hidden');
            showToast('Login realizado com sucesso!');
        })
        .catch((error) => {
            loginError.textContent = 'Email ou senha incorretos.';
            loginError.classList.remove('hidden');
        });
});

logoutBtn.addEventListener('click', () => {
    auth.signOut().then(() => {
        loginForm.classList.remove('hidden');
        productManagement.classList.add('hidden');
        logoutBtn.classList.add('hidden');
        adminEmail.value = '';
        adminPassword.value = '';
        loginError.classList.add('hidden');
        showToast('Logout realizado com sucesso!');
    });
});

addProductForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    try {
        const imageUrl = document.getElementById('productImage').value;

        if (imageUrl && !isValidImageUrl(imageUrl)) {
            showToast('URL da imagem inválida', 'error');
            return;
        }

        const newProduct = {
            name: document.getElementById('productName').value,
            category: document.getElementById('productCategory').value,
            price: parseFloat(document.getElementById('productPrice').value),
            description: document.getElementById('productDescription').value,
            image: imageUrl,
            availability: document.getElementById('productAvailability').checked
        };

        await productsRef.add(newProduct);
        addProductForm.reset();
        loadMenuItems();
        showToast('Produto adicionado com sucesso!');
    } catch (error) {
        console.error("Error adding product: ", error);
        showToast('Erro ao adicionar produto.', 'error');
    }
});

function loadProductTable() {
    const productTableBody = document.getElementById('productTableBody');

    if (allProducts.length === 0) {
        productTableBody.innerHTML = `
<tr>
    <td colspan="5" class="py-4 px-4 text-center text-gray-500">Nenhum produto cadastrado.</td>
</tr>
`;
        return;
    }

    productTableBody.innerHTML = allProducts.map(product => `
<tr class="hover:bg-gray-50">
    <td class="py-3 px-4 border-b">${product.name}</td>
    <td class="py-3 px-4 border-b capitalize">${getCategoryName(product.category)}</td>
    <td class="py-3 px-4 border-b">R$ ${product.price.toFixed(2)}</td>
    <td class="py-3 px-4 border-b">
        <button class="toggle-availability w-12 h-6 rounded-full flex items-center transition-colors duration-300 focus:outline-none ${product.availability ? 'bg-green-400' : 'bg-gray-300'}" data-id="${product.id}" aria-pressed="${product.availability}">
            <span class="dot bg-white w-6 h-6 rounded-full shadow-md transform transition-transform duration-300 ${product.availability ? 'translate-x-6' : ''}"></span>
        </button>
    </td>
    <td class="py-3 px-4 border-b">
        <div class="flex space-x-2">
            <button class="edit-btn bg-caramelo hover:bg-amber-600 text-white py-1 px-2 rounded-md text-sm"
                data-id="${product.id}">
                Editar
            </button>
            <button class="delete-btn bg-red-600 hover:bg-red-700 text-white py-1 px-2 rounded-md text-sm"
                data-id="${product.id}">
                Excluir
            </button>
        </div>
    </td>
</tr>
`).join('');

    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', () => openEditModal(btn.dataset.id));
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', () => openDeleteModal(btn.dataset.id));
    });

    // Adiciona evento para o toggle de disponibilidade
    document.querySelectorAll('.toggle-availability').forEach(btn => {
        btn.addEventListener('click', async function () {
            const productId = btn.dataset.id;
            const product = allProducts.find(p => p.id === productId);
            if (!product) return;
            
            const newAvailability = !product.availability;
            try {
                // Atualiza no Firebase
                await productsRef.doc(productId).update({ availability: newAvailability });
                
                // Atualiza o estado local
                product.availability = newAvailability;
                
                // Atualiza a interface
                loadProductTable();
                displayMenuItems(); // Atualiza o cardápio também
                
                showToast(`Produto ${newAvailability ? 'disponibilizado' : 'indisponibilizado'} com sucesso!`);
            } catch (error) {
                console.error('Erro ao atualizar disponibilidade:', error);
                showToast('Erro ao atualizar disponibilidade.', 'error');
            }
        });
    });
}

function openEditModal(productId) {
    const product = allProducts.find(p => p.id === productId);

    if (product) {
        document.getElementById('editProductId').value = product.id;
        document.getElementById('editProductName').value = product.name;
        document.getElementById('editProductCategory').value = product.category;
        document.getElementById('editProductPrice').value = product.price;
        document.getElementById('editProductDescription').value = product.description;
        document.getElementById('editProductImage').value = product.image || '';
        document.getElementById('editProductAvailability').checked = product.availability !== false;

        editModal.classList.remove('hidden');
    }
}

closeEditModal.addEventListener('click', () => {
    editModal.classList.add('hidden');
});

cancelEditBtn.addEventListener('click', () => {
    editModal.classList.add('hidden');
});

editProductForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    try {
        const productId = document.getElementById('editProductId').value;
        const imageUrl = document.getElementById('editProductImage').value;

        if (imageUrl && !isValidImageUrl(imageUrl)) {
            showToast('URL da imagem inválida', 'error');
            return;
        }

        const updatedProduct = {
            name: document.getElementById('editProductName').value,
            category: document.getElementById('editProductCategory').value,
            price: parseFloat(document.getElementById('editProductPrice').value),
            description: document.getElementById('editProductDescription').value,
            image: imageUrl,
            availability: document.getElementById('editProductAvailability').checked
        };

        await productsRef.doc(productId).update(updatedProduct);
        editModal.classList.add('hidden');
        loadMenuItems();
        showToast('Produto atualizado com sucesso!');
    } catch (error) {
        console.error("Error updating product: ", error);
        showToast('Erro ao atualizar produto.', 'error');
    }
});

function openDeleteModal(productId) {
    document.getElementById('deleteProductId').value = productId;
    deleteModal.classList.remove('hidden');
}

cancelDeleteBtn.addEventListener('click', () => {
    deleteModal.classList.add('hidden');
});

confirmDeleteBtn.addEventListener('click', () => {
    const productId = document.getElementById('deleteProductId').value;

    productsRef.doc(productId).delete()
        .then(() => {
            deleteModal.classList.add('hidden');
            loadMenuItems();
            showToast('Produto excluído com sucesso!');
        })
        .catch((error) => {
            console.error("Error deleting product: ", error);
            showToast('Erro ao excluir produto.', 'error');
        });
});

function showToast(message, type = 'success') {
    toastMessage.textContent = message;

    if (type === 'success') {
        toast.classList.remove('bg-red-500');
        toast.classList.add('bg-green-500');
    } else {
        toast.classList.remove('bg-green-500');
        toast.classList.add('bg-red-500');
    }

    toast.classList.remove('translate-y-20', 'opacity-0');

    setTimeout(() => {
        toast.classList.add('translate-y-20', 'opacity-0');
    }, 3000);
}



document.addEventListener('DOMContentLoaded', () => {
    auth.onAuthStateChanged(function (user) {
        if (user) {
            loginForm.classList.add('hidden');
            productManagement.classList.remove('hidden');
            logoutBtn.classList.remove('hidden');
        }
    });

    loadMenuItems();

    clearCartBtn.addEventListener('click', () => {
        cart = [];
        updateCartDisplay();
        updateCartCount();
        showToast('Carrinho limpo!');
    });

    const searchCepBtn = document.getElementById('searchCepBtn');
    const cepInput = document.getElementById('customerCep');
    const numberInput = document.getElementById('customerNumber');
    const streetInput = document.getElementById('customerStreet');
    const neighborhoodInput = document.getElementById('customerNeighborhood');
    const cityInput = document.getElementById('customerCity');

    numberInput.disabled = true;

    cepInput.addEventListener('input', async (e) => {
        let value = e.target.value.replace(/\D/g, '');
        
        if (value.length > 0) {
            if (value.length <= 2) {
                value = value;
            } else if (value.length <= 5) {
                value = value.slice(0, 2) + '.' + value.slice(2);
            } else {
                value = value.slice(0, 2) + '.' + value.slice(2, 5) + '-' + value.slice(5, 8);
            }
        }
        
        e.target.value = value;
        
        if (value.replace(/\D/g, '').length === 8) {
            const cep = value.replace(/\D/g, '');
            
            try {
                const searchBtn = document.getElementById('searchCepBtn');
                const searchBtnText = document.getElementById('searchCepBtnText');
                const searchBtnLoader = document.getElementById('searchCepBtnLoader');

                searchBtn.disabled = true;
                searchBtnText.classList.add('hidden');
                searchBtnLoader.classList.remove('hidden');

                const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
                const data = await response.json();

                if (data.erro) {
                    throw new Error('CEP não encontrado');
                }

                streetInput.value = data.logradouro || '';
                neighborhoodInput.value = data.bairro || '';
                cityInput.value = `${data.localidade}/${data.uf}` || '';

                numberInput.disabled = false;
                numberInput.focus();

                updateFullAddress();
                showToast('Endereço encontrado!');
            } catch (error) {
                console.error('Erro ao buscar CEP:', error);
                showToast(error.message || 'Erro ao buscar CEP', 'error');

                streetInput.value = '';
                neighborhoodInput.value = '';
                cityInput.value = '';
                numberInput.disabled = true;
            } finally {
                const searchBtn = document.getElementById('searchCepBtn');
                const searchBtnText = document.getElementById('searchCepBtnText');
                const searchBtnLoader = document.getElementById('searchCepBtnLoader');

                searchBtn.disabled = false;
                searchBtnText.classList.remove('hidden');
                searchBtnLoader.classList.add('hidden');
            }
        }
    });

    searchCepBtn.addEventListener('click', async () => {
        const cep = cepInput.value.replace(/\D/g, '');

        if (cep.length !== 8) {
            showToast('CEP inválido. Digite 8 números.', 'error');
            return;
        }

        try {
            const searchBtn = document.getElementById('searchCepBtn');
            const searchBtnText = document.getElementById('searchCepBtnText');
            const searchBtnLoader = document.getElementById('searchCepBtnLoader');

            searchBtn.disabled = true;
            searchBtnText.classList.add('hidden');
            searchBtnLoader.classList.remove('hidden');

            const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const data = await response.json();

            if (data.erro) {
                throw new Error('CEP não encontrado');
            }

            streetInput.value = data.logradouro || '';
            neighborhoodInput.value = data.bairro || '';
            cityInput.value = `${data.localidade}/${data.uf}` || '';

            numberInput.disabled = false;
            numberInput.focus();

            updateFullAddress();
            showToast('Endereço encontrado!');
        } catch (error) {
            console.error('Erro ao buscar CEP:', error);
            showToast(error.message || 'Erro ao buscar CEP', 'error');

            streetInput.value = '';
            neighborhoodInput.value = '';
            cityInput.value = '';
            numberInput.disabled = true;
        } finally {
            const searchBtn = document.getElementById('searchCepBtn');
            const searchBtnText = document.getElementById('searchCepBtnText');
            const searchBtnLoader = document.getElementById('searchCepBtnLoader');

            searchBtn.disabled = false;
            searchBtnText.classList.remove('hidden');
            searchBtnLoader.classList.add('hidden');
        }
    });

    numberInput.addEventListener('input', () => {
        updateFullAddress();
    });

    document.getElementById('paymentMethod').addEventListener('change', updateTotals);
});

let cart = [];
const cartBtn = document.getElementById('cartBtn');
const cartBtnMobile = document.getElementById('cartBtnMobile');
const cartModal = document.getElementById('cartModal');
const closeCartModal = document.getElementById('closeCartModal');
const cartItems = document.getElementById('cartItems');
const cartTotal = document.getElementById('cartTotal');
const clearCartBtn = document.getElementById('clearCartBtn');
const orderForm = document.getElementById('orderForm');

const STORE_LOCATION = {
    lat: -8.182395619188558,
    lng: -34.92545928989991
};

const PAYMENT_FEES = {
    'Cartão de Crédito': 2.00,
    'Cartão de Débito': 1.00,
    'Pix': 0,
    'Dinheiro': 0
};

const FREE_DELIVERY_DISTANCE = 1.5; // Distância em km para entrega gratuita
const DELIVERY_RATE_PER_KM = 2.00; // R$ 2,00 por km
const MIN_DELIVERY_FEE = 5.00; // Taxa mínima de entrega

// Função para calcular a distância
async function calculateDistance(address) {
    return new Promise((resolve, reject) => {
        const geocoder = new google.maps.Geocoder();

        geocoder.geocode({ address: address }, (results, status) => {
            if (status === 'OK') {
                const customerLocation = results[0].geometry.location;

                // Calcular distância usando a fórmula de Haversine
                const R = 6371; // Raio da Terra em km
                const lat1 = STORE_LOCATION.lat * Math.PI / 180;
                const lat2 = customerLocation.lat() * Math.PI / 180;
                const deltaLat = (customerLocation.lat() - STORE_LOCATION.lat) * Math.PI / 180;
                const deltaLng = (customerLocation.lng() - STORE_LOCATION.lng) * Math.PI / 180;

                const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
                    Math.cos(lat1) * Math.cos(lat2) *
                    Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                const distance = R * c; // Distância em km

                resolve(distance);
            } else {
                reject('Não foi possível calcular a distância');
            }
        });
    });
}

// Função para calcular taxa de entrega
function calculateDeliveryFee(distance) {
    // Se a distância for menor ou igual a FREE_DELIVERY_DISTANCE, retorna 0
    if (distance <= FREE_DELIVERY_DISTANCE) {
        return 0;
    }

    // Para distâncias maiores, calcula a taxa apenas para a distância excedente
    const extraDistance = distance - FREE_DELIVERY_DISTANCE;
    const fee = Math.max(MIN_DELIVERY_FEE, extraDistance * DELIVERY_RATE_PER_KM);
    return Math.round(fee * 100) / 100; // Arredonda para 2 casas decimais
}

// Função para calcular taxa de pagamento
function calculatePaymentFee(method) {
    return PAYMENT_FEES[method] || 0;
}

// Função para animar valor
function animateValue(element, start, end, duration) {
    const startTimestamp = performance.now();
    const formatter = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });

    const animate = (currentTimestamp) => {
        const elapsed = currentTimestamp - startTimestamp;
        const progress = Math.min(elapsed / duration, 1);

        // Função de easing para uma animação mais suave
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);

        const current = start + (end - start) * easeOutQuart;
        element.textContent = formatter.format(current);

        if (progress < 1) {
            requestAnimationFrame(animate);
        }
    };

    requestAnimationFrame(animate);
}

// Função para atualizar totais
async function updateTotals() {
    const subtotalElement = document.getElementById('subtotal');
    const deliveryFeeElement = document.getElementById('deliveryFee');
    const paymentFeeElement = document.getElementById('paymentFee');
    const paymentFeeContainer = document.getElementById('paymentFeeContainer');
    const totalElement = document.getElementById('cartTotal');

    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const paymentMethod = document.getElementById('paymentMethod').value;
    const address = document.getElementById('deliveryAddress').value;

    let deliveryFee = 0;
    let paymentFee = calculatePaymentFee(paymentMethod);
    let total = subtotal + paymentFee;

    // Mostrar/esconder container da taxa de pagamento
    if (paymentMethod === 'Cartão de Crédito' || paymentMethod === 'Cartão de Débito') {
        paymentFeeContainer.classList.remove('hidden');
    } else {
        paymentFeeContainer.classList.add('hidden');
    }

    // Extrair valores numéricos atuais
    const currentSubtotal = parseFloat(subtotalElement.textContent.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
    const currentDeliveryFee = parseFloat(deliveryFeeElement.textContent.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
    const currentPaymentFee = parseFloat(paymentFeeElement.textContent.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
    const currentTotal = parseFloat(totalElement.textContent.replace(/[^\d,]/g, '').replace(',', '.')) || 0;

    // Animar subtotal
    animateValue(subtotalElement, currentSubtotal, subtotal, 500);
    animateValue(paymentFeeElement, currentPaymentFee, paymentFee, 500);

    if (address) {
        try {
            const distance = await calculateDistance(address);
            deliveryFee = calculateDeliveryFee(distance);

            const distanceText = distance <= FREE_DELIVERY_DISTANCE
                ? `${distance.toFixed(1)} km (Grátis!)`
                : `${distance.toFixed(1)} km`;

            // Animar taxa de entrega
            animateValue(deliveryFeeElement, currentDeliveryFee, deliveryFee, 500);
            document.getElementById('distance').textContent = distanceText;
        } catch (error) {
            console.error('Erro ao calcular distância:', error);
            deliveryFeeElement.textContent = 'Erro no cálculo';
            document.getElementById('distance').textContent = 'N/A';
        }
    } else {
        deliveryFeeElement.textContent = 'R$ 0,00';
        document.getElementById('distance').textContent = '(0 km)';
    }

    total += deliveryFee;
    // Animar total
    animateValue(totalElement, currentTotal, total, 500);

    return { subtotal, deliveryFee, paymentFee, total };
}

// Cart Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    const floatingCartBtn = document.getElementById('floatingCartBtn');
    const cartModal = document.getElementById('cartModal');
    const closeCartModal = document.getElementById('closeCartModal');
    const cartSlider = document.getElementById('cartSlider');

    // Função para abrir o carrinho
    function openCart() {
        cartModal.classList.remove('hidden');
        setTimeout(() => {
            cartModal.classList.add('open');
        }, 10);
        updateCartDisplay();
        // Hide floating cart button when cart is open
        if (floatingCartBtn) {
            floatingCartBtn.classList.add('hidden');
        }
    }

    // Função para fechar o carrinho
    function closeCart() {
        cartModal.classList.remove('open');
        setTimeout(() => {
            cartModal.classList.add('hidden');
        }, 300);
        // Show floating cart button when cart is closed
        if (floatingCartBtn) {
            floatingCartBtn.classList.remove('hidden');
        }
    }

    // Event listeners para os botões do carrinho
    if (cartBtn) {
        cartBtn.addEventListener('click', openCart);
    }

    if (cartBtnMobile) {
        cartBtnMobile.addEventListener('click', () => {
            if (mobileMenu) {
                mobileMenu.classList.add('hidden');
            }
            openCart();
        });
    }

    if (floatingCartBtn) {
        floatingCartBtn.addEventListener('click', openCart);
    }

    if (closeCartModal) {
        closeCartModal.addEventListener('click', closeCart);
    }

    if (cartModal) {
        cartModal.addEventListener('click', (e) => {
            if (e.target === cartModal) {
                closeCart();
            }
        });
    }

    // Handle order submission
    if (orderForm) {
        orderForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (cart.length === 0) {
                showToast('Adicione itens ao carrinho antes de finalizar o pedido', 'error');
                return;
            }

            const name = document.getElementById('customerName').value;
            const phone = document.getElementById('customerPhone').value;
            const address = document.getElementById('deliveryAddress').value;
            const notes = document.getElementById('orderNotes').value;
            const paymentMethod = document.getElementById('paymentMethod').value;

            if (!address) {
                showToast('Por favor, preencha o CEP e o número do endereço', 'error');
                return;
            }

            // Get all fees and totals
            const { subtotal, deliveryFee, paymentFee, total } = await updateTotals();

            // Format the WhatsApp message
            let message = `Novo Pedido:\n`;
            message += `Cliente: ${name}\n`;
            message += `Telefone: ${phone}\n`;
            message += `Endereço: ${address}\n\n`;

            message += `Itens:\n`;
            cart.forEach(item => {
                message += `${item.quantity}x ${item.name} - R$ ${(item.price * item.quantity).toFixed(2)}\n`;
            });

            message += `\nSubtotal: R$ ${subtotal.toFixed(2)}\n`;
            message += `Taxa de Entrega: R$ ${deliveryFee.toFixed(2)}\n`;
            message += `Taxa de Pagamento: R$ ${paymentFee.toFixed(2)}\n`;
            message += `Total: R$ ${total.toFixed(2)}\n`;
            message += `Forma de Pagamento: ${paymentMethod}\n`;

            // Adiciona informação do troco se for pagamento em dinheiro
            if (paymentMethod === 'Dinheiro') {
                const changeAmount = document.getElementById('changeAmount').value;
                if (changeAmount && parseFloat(changeAmount) > 0) {
                    message += `Troco para: R$ ${parseFloat(changeAmount).toFixed(2)}\n`;
                }
            }
            message += '\n';

            if (notes) {
                message += `Observações: ${notes}`;
            }

            // Encode the message for WhatsApp URL
            const encodedMessage = encodeURIComponent(message);
            const whatsappNumber = '5581987484019';
            const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;

            // Open WhatsApp in a new tab
            window.location.href = whatsappUrl;

            // Clear the cart and form
            cart = [];
            orderForm.reset();
            updateCartDisplay();
            updateCartCount();
            closeCart();
            showToast('Pedido enviado com sucesso!');
        });
    }
});

// Update cart display
function updateCartDisplay() {
    if (!cartItems) return;

    if (cart.length === 0) {
        cartItems.innerHTML = `
        <div class="flex flex-col items-center justify-center py-8 text-gray-500">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                                                    </svg>
            <p class="text-lg font-medium mb-2">Seu carrinho está vazio</p>
            <p class="text-sm">Adicione itens do cardápio para fazer seu pedido</p>
        </div>`;
        updateTotals();
        return;
    }

    let html = '';
    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        html += `
        <div class="bg-white rounded-lg shadow-sm p-4 flex items-center space-x-4">
            ${item.image ?
                `<img src="${item.image}" alt="${item.name}" class="w-20 h-20 object-cover rounded-lg flex-shrink-0">` :
                `<div class="w-20 h-20 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                    </svg>
                </div>`
            }
            <div class="flex-1 min-w-0">
                <div class="flex justify-between items-start mb-2">
                    <h4 class="text-lg font-medium text-gray-900 truncate">${item.name}</h4>
                    <button onclick="removeFromCart('${item.id}')" class="text-gray-400 hover:text-vermelho transition-colors" title="Remover item">
                                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                                                    </svg>
                    </button>
                        </div>
                <div class="flex justify-between items-center">
                    <div class="flex items-center space-x-2">
                        <button onclick="updateQuantity('${item.id}', -1)" class="text-gray-500 hover:text-vermelho transition-colors p-1">
                                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd" />
                                                    </svg>
                        </button>
                        <span class="text-gray-700 font-medium w-8 text-center">${item.quantity}</span>
                        <button onclick="updateQuantity('${item.id}', 1)" class="text-gray-500 hover:text-vermelho transition-colors p-1">
                                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
                                                    </svg>
                        </button>
                    </div>
                    <div class="text-right">
                        <div class="text-sm text-gray-500">R$ ${item.price.toFixed(2)} cada</div>
                        <div class="text-vermelho font-medium">R$ ${itemTotal.toFixed(2)}</div>
                    </div>
                </div>
                    </div>
                </div>
            `;
    });

    cartItems.innerHTML = html;
    updateTotals();
}

// Update cart count
function updateCartCount() {
    const count = cart.reduce((total, item) => total + item.quantity, 0);
    document.getElementById('cartItemCount').textContent = count;
    document.getElementById('cartItemCountMobile').textContent = count;
    document.getElementById('floatingCartItemCount').textContent = count;
}

// Add to cart function
function addToCart(product) {
    if (!product.availability) {
        showToast('Este produto está indisponível', 'error');
        return;
    }

    const existingItem = cart.find(item => item.id === product.id);
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            ...product,
            quantity: 1
        });
    }
    updateCartCount();
    updateCartDisplay();
    showToast('Item adicionado ao carrinho!');
}

// Remove from cart function
function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    updateCartDisplay();
    updateCartCount();
}

// Update quantity function
function updateQuantity(productId, change) {
    const item = cart.find(item => item.id === productId);
    if (item) {
        item.quantity += change;
        if (item.quantity <= 0) {
            removeFromCart(productId);
        } else {
            updateCartDisplay();
            updateCartCount();
        }
    }
}

// Funções de CEP e Endereço
async function searchCep(cep) {
    const searchBtn = document.getElementById('searchCepBtn');
    const searchBtnText = document.getElementById('searchCepBtnText');
    const searchBtnLoader = document.getElementById('searchCepBtnLoader');

    try {
        // Mostra o loader e desabilita o botão
        searchBtn.disabled = true;
        searchBtnText.classList.add('hidden');
        searchBtnLoader.classList.remove('hidden');

        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await response.json();

        if (data.erro) {
            throw new Error('CEP não encontrado');
        }

        return data;
    } catch (error) {
        throw new Error('Erro ao buscar CEP');
    } finally {
        // Esconde o loader e reabilita o botão
        searchBtn.disabled = false;
        searchBtnText.classList.remove('hidden');
        searchBtnLoader.classList.add('hidden');
    }
}

function updateAddressFields(addressData) {
    document.getElementById('customerStreet').value = addressData.logradouro;
    document.getElementById('customerNeighborhood').value = addressData.bairro;
    document.getElementById('customerCity').value = `${addressData.localidade}/${addressData.uf}`;

    // Habilita o campo de número
    const numberField = document.getElementById('customerNumber');
    numberField.disabled = false;
    numberField.focus();
}

function updateFullAddress() {
    const street = document.getElementById('customerStreet').value;
    const number = document.getElementById('customerNumber').value;
    const neighborhood = document.getElementById('customerNeighborhood').value;
    const city = document.getElementById('customerCity').value;
    const deliveryAddressInput = document.getElementById('deliveryAddress');

    if (street && number && neighborhood && city) {
        const fullAddress = `${street}, ${number} - ${neighborhood}, ${city}`;
        deliveryAddressInput.value = fullAddress;
        updateTotals(); // Atualiza os totais quando o endereço é alterado
        return fullAddress;
    }

    deliveryAddressInput.value = '';
    return '';
}

// Variables for product details modal
const productDetailsModal = document.getElementById('productDetailsModal');
const closeProductModal = document.getElementById('closeProductModal');
const confirmAddToCart = document.getElementById('confirmAddToCart');
let selectedProduct = null;

// Function to show product details modal
function showProductDetails(product) {
    selectedProduct = product;

    // Update modal content
    document.getElementById('modalProductName').textContent = product.name;
    document.getElementById('modalProductDescription').textContent = product.description;
    document.getElementById('modalProductPrice').textContent = `R$ ${product.price.toFixed(2)}`;

    // Update product image
    const imageElement = document.getElementById('modalProductImageElement');
    const imagePlaceholder = document.getElementById('modalProductImagePlaceholder');

    if (product.image) {
        imageElement.src = product.image;
        imageElement.alt = product.name;
        imageElement.style.display = 'block';
        imagePlaceholder.style.display = 'none';
    } else {
        imageElement.style.display = 'none';
        imagePlaceholder.style.display = 'block';
    }

    // Show modal
    productDetailsModal.classList.remove('hidden');
}

// Function to close product details modal
function closeProductDetails() {
    productDetailsModal.classList.add('hidden');
    selectedProduct = null;
}

// Event listeners for modal
closeProductModal.addEventListener('click', closeProductDetails);
productDetailsModal.addEventListener('click', (e) => {
    if (e.target === productDetailsModal) {
        closeProductDetails();
    }
});

// Event listener for confirm add to cart button
confirmAddToCart.addEventListener('click', () => {
    if (selectedProduct) {
        if (!selectedProduct.availability) {
            showToast('Este produto está indisponível', 'error');
            return;
        }

        const existingItem = cart.find(item => item.id === selectedProduct.id);
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            cart.push({
                ...selectedProduct,
                quantity: 1
            });
        }
        updateCartCount();
        updateCartDisplay();
        showToast('Item adicionado ao carrinho!');
        closeProductDetails();
    }
});

// Modify the displayMenuItems function to use the new modal
function displayMenuItems() {
    if (allProducts.length === 0) {
        menuItems.innerHTML = `
                <div class="col-span-full text-center py-12">
                    <p class="text-gray-500">Nenhum item encontrado no cardápio.</p>
                </div>
            `;
        return;
    }

    let filteredProducts = allProducts;
    if (currentCategory !== 'all') {
        filteredProducts = allProducts.filter(product => product.category === currentCategory);
    }

    // Ordenar produtos: disponíveis primeiro, depois feijoadas, depois ordem alfabética
    filteredProducts.sort((a, b) => {
        // Disponíveis primeiro
        if (a.availability && !b.availability) return -1;
        if (!a.availability && b.availability) return 1;
        // Feijoadas primeiro
        const aHasFeijoada = a.name.toLowerCase().includes('feijoada');
        const bHasFeijoada = b.name.toLowerCase().includes('feijoada');
        if (aHasFeijoada && !bHasFeijoada) return -1;
        if (!aHasFeijoada && bHasFeijoada) return 1;
        // Ordem alfabética
        return a.name.localeCompare(b.name, 'pt-BR');
    });

    if (filteredProducts.length === 0) {
        menuItems.innerHTML = `
                <div class="col-span-full text-center py-12">
                    <p class="text-gray-500">Nenhum item encontrado nesta categoria.</p>
                </div>
            `;
        return;
    }

    menuItems.innerHTML = filteredProducts.map(product => `
            <div class="card bg-white rounded-lg shadow-md overflow-hidden ${!product.availability ? 'opacity-75' : ''}">
                <div class="h-48 bg-${getCategoryColor(product.category)} flex items-center justify-center relative">
                    ${product.image ? `<img src="${product.image}" alt="${product.name}" class="h-full w-full object-cover">` :
            `<svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>`}
                    ${!product.availability ? `
                    <div class="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                        <span class="text-white font-medium px-4 py-2 bg-vermelho rounded-md">Indisponível</span>
                    </div>
                    ` : ''}
                </div>
                <div class="p-4">
                    <div class="flex justify-between items-start mb-2">
                        <h3 class="text-lg font-semibold text-marrom">${product.name}</h3>
                        <span class="bg-caramelo text-white px-2 py-1 rounded-full text-sm font-medium">R$ ${product.price.toFixed(2)}</span>
                    </div>
                    <p class="text-gray-600 text-sm mb-3">${product.description}</p>
                    <div class="flex justify-between items-center">
                        <span class="text-xs text-gray-500 capitalize">${getCategoryName(product.category)}</span>
                        <button onclick="${product.availability ? `showProductDetails(${JSON.stringify({ ...product }).replace(/"/g, "'")})` : 'showToast(\'Produto indisponível\', \'error\')'}" 
                            class="${product.availability ? 'bg-vermelho hover:bg-red-800' : 'bg-gray-400 cursor-not-allowed'} text-white text-sm py-1 px-3 rounded-md transition-colors">
                            ${product.availability ? 'Adicionar' : 'Indisponível'}
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
}

const settingsRef = db.collection('settings').doc('main');
const closedBanner = document.getElementById('closedBanner');
const toggleClosed = document.getElementById('toggleClosed');

// Função para atualizar o status do restaurante
async function setClosedStatus(isClosed) {
    await settingsRef.set({ isClosed }, { merge: true });
}

// Carregar status ao abrir admin
if (toggleClosed) {
    settingsRef.get().then(doc => {
        if (doc.exists && doc.data().isClosed) {
            toggleClosed.checked = true;
        } else {
            toggleClosed.checked = false;
        }
    });
    toggleClosed.addEventListener('change', async (e) => {
        await setClosedStatus(e.target.checked);
        showToast(e.target.checked ? 'Restaurante marcado como fechado!' : 'Restaurante aberto!');
        updateClosedBanner();
    });
}

// Exibir/ocultar banner de fechado
function updateClosedBanner() {
    settingsRef.get().then(doc => {
        if (doc.exists && doc.data().isClosed) {
            closedBanner.classList.remove('hidden');
            // Opcional: desabilitar botões de adicionar
            document.querySelectorAll('.card button').forEach(btn => btn.disabled = true);
        } else {
            closedBanner.classList.add('hidden');
            document.querySelectorAll('.card button').forEach(btn => btn.disabled = false);
        }
    });
}

// Checar status ao carregar página
window.addEventListener('DOMContentLoaded', updateClosedBanner);