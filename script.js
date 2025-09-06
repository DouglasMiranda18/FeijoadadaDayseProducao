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

// Inicializa o Firebase
if (!firebase.apps.length) {
    try {
        firebase.initializeApp(firebaseConfig);
        console.log('Firebase inicializado com sucesso');
    } catch (error) {
        console.error('Erro ao inicializar Firebase:', error);
    }
}

const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();
const productsRef = db.collection('products');

// Adiciona listener para mudanças no estado de autenticação
auth.onAuthStateChanged((user) => {
    console.log('Estado de autenticação:', user ? 'Usuário logado' : 'Usuário não logado');
});

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

    productsRef.get()
        .then((snapshot) => {
            console.log('Dados recebidos do Firestore:', snapshot.size, 'documentos');
            allProducts = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                console.log('Produto carregado:', {
                    id: doc.id,
                    ...data
                });
                
                // Validação dos campos obrigatórios
                if (!data.name || !data.price || !data.category) {
                    console.warn('Produto com campos obrigatórios faltando:', doc.id);
                    return;
                }

                allProducts.push({
                    id: doc.id,
                    name: data.name,
                    price: Number(data.price),
                    category: data.category,
                    description: data.description || '',
                    image: data.image || '',
                    availability: data.availability !== undefined ? data.availability : true
                });
            });
            
            console.log('Total de produtos carregados:', allProducts.length);
            displayMenuItems();
            loadProductTable();
        })
        .catch((error) => {
            console.error("Erro ao carregar itens do cardápio: ", error);
            let errorMessage = "Erro ao carregar o cardápio. ";
            
            if (error.code === 'permission-denied') {
                errorMessage += "Erro de permissão. Por favor, verifique as regras do Firestore.";
            } else if (error.code === 'unavailable') {
                errorMessage += "Serviço indisponível. Por favor, tente novamente mais tarde.";
            } else {
                errorMessage += "Por favor, tente novamente mais tarde.";
            }
            
            menuItems.innerHTML = `
                    <div class="col-span-full text-center py-12">
                        <p class="text-red-500">${errorMessage}</p>
                        <button onclick="loadMenuItems()" class="mt-4 bg-caramelo hover:bg-amber-600 text-white px-4 py-2 rounded-md">
                            Tentar Novamente
                        </button>
                    </div>
                `;
        });
}

// ==========================================================================================
// AQUI ESTÁ A FUNÇÃO ATUALIZADA
// ==========================================================================================
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
    // O filtro inicial por categoria continua o mesmo
    if (currentCategory !== 'all') {
        filteredProducts = allProducts.filter(product => product.category.toLowerCase() === currentCategory);
    }

    // --- INÍCIO DA LÓGICA DE ORDENAÇÃO CORRIGIDA ---

    // SE A CATEGORIA FOR "TODOS", APLICA A ORDEM ESPECIAL
    if (currentCategory === 'all') {
        filteredProducts.sort((a, b) => {
            // Regra 1: Disponibilidade
            if (a.availability && !b.availability) return -1;
            if (!a.availability && b.availability) return 1;

            const aIsFeijoada = a.name.toLowerCase().includes('feijoada');
            const bIsFeijoada = b.name.toLowerCase().includes('feijoada');
            const aIsDrink = a.category.toLowerCase() === 'bebidas';
            const bIsDrink = b.category.toLowerCase() === 'bebidas';

            // Regra 2: Feijoada no topo
            if (aIsFeijoada && !bIsFeijoada) return -1;
            if (!aIsFeijoada && bIsFeijoada) return 1;
            if (aIsFeijoada && bIsFeijoada) {
                return a.name.localeCompare(b.name, 'pt-BR');
            }

            // Regra 3: Comidas antes de bebidas
            if (!aIsDrink && bIsDrink) return -1;
            if (aIsDrink && !bIsDrink) return 1;

            // Regra 4: Ordem alfabética para os demais
            return a.name.localeCompare(b.name, 'pt-BR');
        });
    } else {
        // CASO CONTRÁRIO (PARA OUTRAS CATEGORIAS), APLICA UMA ORDEM SIMPLES
        filteredProducts.sort((a, b) => {
            // Regra 1: Disponibilidade
            if (a.availability && !b.availability) return -1;
            if (!a.availability && b.availability) return 1;

            // Regra 2: Ordem alfabética
            return a.name.localeCompare(b.name, 'pt-BR');
        });
    }
    // --- FIM DA LÓGICA DE ORDENAÇÃO ---


    if (filteredProducts.length === 0) {
        menuItems.innerHTML = `
                <div class="col-span-full text-center py-12">
                    <p class="text-gray-500">Nenhum item encontrado nesta categoria.</p>
                </div>
            `;
        return;
    }

    menuItems.innerHTML = filteredProducts.map(product => {
        const price = typeof product.price === 'number' ? product.price : parseFloat(product.price);
        
        return `
            <div class="card bg-white rounded-lg shadow-md overflow-hidden ${!product.availability ? 'opacity-75' : ''}">
                <div class="h-48 bg-${getCategoryColor(product.category.toLowerCase())} flex items-center justify-center relative">
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
                        <span class="bg-caramelo text-white px-2 py-1 rounded-full text-sm font-medium">R$ ${price.toFixed(2)}</span>
                    </div>
                    <p class="text-gray-600 text-sm mb-3">${product.description || ''}</p>
                    <div class="flex justify-between items-center">
                        <span class="text-xs text-gray-500 capitalize">${getCategoryName(product.category)}</span>
                        <button onclick="${product.availability ? `showProductDetails(${JSON.stringify({ ...product }).replace(/"/g, "'")})` : 'showToast(\'Produto indisponível\', \'error\')'}" 
                            class="${product.availability ? 'bg-vermelho hover:bg-red-800' : 'bg-gray-400 cursor-not-allowed'} text-white text-sm py-1 px-3 rounded-md transition-colors">
                            ${product.availability ? 'Adicionar' : 'Indisponível'}
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}
// ==========================================================================================
// FIM DA FUNÇÃO ATUALIZADA
// ==========================================================================================


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
    switch (category.toLowerCase()) {
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

                // Tenta múltiplas APIs de CEP para maior confiabilidade
                let data = null;
                
                try {
                    // Primeira tentativa: ViaCEP
                    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
                    data = await response.json();
                    
                    if (data.erro) {
                        throw new Error('CEP não encontrado no ViaCEP');
                    }
                } catch (viaCepError) {
                    console.warn('ViaCEP falhou, tentando API alternativa:', viaCepError);
                    
                    try {
                        // Segunda tentativa: API alternativa
                        const response = await fetch(`https://cep.awesomeapi.com.br/json/${cep}`);
                        data = await response.json();
                        
                        if (data.status === 400) {
                            throw new Error('CEP não encontrado na API alternativa');
                        }
                        
                        // Adapta o formato da resposta
                        data = {
                            logradouro: data.address || data.street || '',
                            bairro: data.district || data.neighborhood || '',
                            localidade: data.city || '',
                            uf: data.state || ''
                        };
                    } catch (altApiError) {
                        console.warn('API alternativa falhou:', altApiError);
                        throw new Error('CEP não encontrado em nenhuma API');
                    }
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
                showToast('CEP não encontrado. Verifique o número digitado.', 'error');

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

            // Tenta múltiplas APIs de CEP para maior confiabilidade
            let data = null;
            
            try {
                // Primeira tentativa: ViaCEP
                const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
                data = await response.json();
                
                if (data.erro) {
                    throw new Error('CEP não encontrado no ViaCEP');
                }
            } catch (viaCepError) {
                console.warn('ViaCEP falhou, tentando API alternativa:', viaCepError);
                
                try {
                    // Segunda tentativa: API alternativa
                    const response = await fetch(`https://cep.awesomeapi.com.br/json/${cep}`);
                    data = await response.json();
                    
                    if (data.status === 400) {
                        throw new Error('CEP não encontrado na API alternativa');
                    }
                    
                    // Adapta o formato da resposta
                    data = {
                        logradouro: data.address || data.street || '',
                        bairro: data.district || data.neighborhood || '',
                        localidade: data.city || '',
                        uf: data.state || ''
                    };
                } catch (altApiError) {
                    console.warn('API alternativa falhou:', altApiError);
                    throw new Error('CEP não encontrado em nenhuma API');
                }
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
            showToast('CEP não encontrado. Verifique o número digitado.', 'error');

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

// Sistema de cálculo de distância usando apenas CEP (sem Google Maps)
document.addEventListener('DOMContentLoaded', function() {
    console.log('Sistema de cálculo de distância: Usando estimativa baseada em CEP');
});

const PAYMENT_FEES = {
    'Cartão de Crédito': 2.00,
    'Cartão de Débito': 1.00,
    'Pix': 0,
    'Dinheiro': 0
};

const FREE_DELIVERY_DISTANCE = 0.6; // Distância em km para entrega gratuita
const DELIVERY_RATE_PER_KM = 2.00; // R$ 2,00 por km
const MIN_DELIVERY_FEE = 5.00; // Taxa mínima de entrega

// Sistema de cálculo de frete baseado em zonas de CEP (sem APIs externas)
function calculateDeliveryFeeByZone(cep) {
    const cepNumber = cep.replace(/\D/g, '');
    
    // Zona 1: Piedade e arredores (entrega gratuita)
    const zona1 = [
        '54410', '54411', '54412', '54413', '54414', '54415', '54416', '54417', '54418', '54419',
        '54420', '54421', '54422', '54423', '54424', '54425', '54426', '54427', '54428', '54429'
    ];
    
    // Zona 2: Jaboatão dos Guararapes (taxa baixa)
    const zona2 = [
        '54430', '54431', '54432', '54433', '54434', '54435', '54436', '54437', '54438', '54439',
        '54440', '54441', '54442', '54443', '54444', '54445', '54446', '54447', '54448', '54449',
        '54450', '54451', '54452', '54453', '54454', '54455', '54456', '54457', '54458', '54459',
        '54460', '54461', '54462', '54463', '54464', '54465', '54466', '54467', '54468', '54469',
        '54470', '54471', '54472', '54473', '54474', '54475', '54476', '54477', '54478', '54479',
        '54480', '54481', '54482', '54483', '54484', '54485', '54486', '54487', '54488', '54489',
        '54490', '54491', '54492', '54493', '54494', '54495', '54496', '54497', '54498', '54499'
    ];
    
    // Zona 3: Recife (taxa média)
    const zona3 = [
        '50000', '50001', '50002', '50003', '50004', '50005', '50006', '50007', '50008', '50009',
        '50010', '50011', '50012', '50013', '50014', '50015', '50016', '50017', '50018', '50019',
        '50020', '50021', '50022', '50023', '50024', '50025', '50026', '50027', '50028', '50029',
        '50030', '50031', '50032', '50033', '50034', '50035', '50036', '50037', '50038', '50039',
        '50040', '50041', '50042', '50043', '50044', '50045', '50046', '50047', '50048', '50049',
        '50050', '50051', '50052', '50053', '50054', '50055', '50056', '50057', '50058', '50059',
        '50060', '50061', '50062', '50063', '50064', '50065', '50066', '50067', '50068', '50069',
        '50070', '50071', '50072', '50073', '50074', '50075', '50076', '50077', '50078', '50079',
        '50080', '50081', '50082', '50083', '50084', '50085', '50086', '50087', '50088', '50089',
        '50090', '50091', '50092', '50093', '50094', '50095', '50096', '50097', '50098', '50099',
        '51000', '51001', '51002', '51003', '51004', '51005', '51006', '51007', '51008', '51009',
        '51010', '51011', '51012', '51013', '51014', '51015', '51016', '51017', '51018', '51019',
        '51020', '51021', '51022', '51023', '51024', '51025', '51026', '51027', '51028', '51029',
        '51030', '51031', '51032', '51033', '51034', '51035', '51036', '51037', '51038', '51039',
        '51040', '51041', '51042', '51043', '51044', '51045', '51046', '51047', '51048', '51049',
        '51050', '51051', '51052', '51053', '51054', '51055', '51056', '51057', '51058', '51059',
        '51060', '51061', '51062', '51063', '51064', '51065', '51066', '51067', '51068', '51069',
        '51070', '51071', '51072', '51073', '51074', '51075', '51076', '51077', '51078', '51079',
        '51080', '51081', '51082', '51083', '51084', '51085', '51086', '51087', '51088', '51089',
        '51090', '51091', '51092', '51093', '51094', '51095', '51096', '51097', '51098', '51099',
        '52000', '52001', '52002', '52003', '52004', '52005', '52006', '52007', '52008', '52009',
        '52010', '52011', '52012', '52013', '52014', '52015', '52016', '52017', '52018', '52019',
        '52020', '52021', '52022', '52023', '52024', '52025', '52026', '52027', '52028', '52029',
        '52030', '52031', '52032', '52033', '52034', '52035', '52036', '52037', '52038', '52039',
        '52040', '52041', '52042', '52043', '52044', '52045', '52046', '52047', '52048', '52049',
        '52050', '52051', '52052', '52053', '52054', '52055', '52056', '52057', '52058', '52059',
        '52060', '52061', '52062', '52063', '52064', '52065', '52066', '52067', '52068', '52069',
        '52070', '52071', '52072', '52073', '52074', '52075', '52076', '52077', '52078', '52079',
        '52080', '52081', '52082', '52083', '52084', '52085', '52086', '52087', '52088', '52089',
        '52090', '52091', '52092', '52093', '52094', '52095', '52096', '52097', '52098', '52099',
        '53000', '53001', '53002', '53003', '53004', '53005', '53006', '53007', '53008', '53009',
        '53010', '53011', '53012', '53013', '53014', '53015', '53016', '53017', '53018', '53019',
        '53020', '53021', '53022', '53023', '53024', '53025', '53026', '53027', '53028', '53029',
        '53030', '53031', '53032', '53033', '53034', '53035', '53036', '53037', '53038', '53039',
        '53040', '53041', '53042', '53043', '53044', '53045', '53046', '53047', '53048', '53049',
        '53050', '53051', '53052', '53053', '53054', '53055', '53056', '53057', '53058', '53059',
        '53060', '53061', '53062', '53063', '53064', '53065', '53066', '53067', '53068', '53069',
        '53070', '53071', '53072', '53073', '53074', '53075', '53076', '53077', '53078', '53079',
        '53080', '53081', '53082', '53083', '53084', '53085', '53086', '53087', '53088', '53089',
        '53090', '53091', '53092', '53093', '53094', '53095', '53096', '53097', '53098', '53099'
    ];
    
    // Zona 4: Outros municípios de PE (taxa alta)
    const zona4 = [
        '54000', '54001', '54002', '54003', '54004', '54005', '54006', '54007', '54008', '54009',
        '54010', '54011', '54012', '54013', '54014', '54015', '54016', '54017', '54018', '54019',
        '54020', '54021', '54022', '54023', '54024', '54025', '54026', '54027', '54028', '54029',
        '54030', '54031', '54032', '54033', '54034', '54035', '54036', '54037', '54038', '54039',
        '54040', '54041', '54042', '54043', '54044', '54045', '54046', '54047', '54048', '54049',
        '54050', '54051', '54052', '54053', '54054', '54055', '54056', '54057', '54058', '54059',
        '54060', '54061', '54062', '54063', '54064', '54065', '54066', '54067', '54068', '54069',
        '54070', '54071', '54072', '54073', '54074', '54075', '54076', '54077', '54078', '54079',
        '54080', '54081', '54082', '54083', '54084', '54085', '54086', '54087', '54088', '54089',
        '54090', '54091', '54092', '54093', '54094', '54095', '54096', '54097', '54098', '54099',
        '54100', '54101', '54102', '54103', '54104', '54105', '54106', '54107', '54108', '54109',
        '54110', '54111', '54112', '54113', '54114', '54115', '54116', '54117', '54118', '54119',
        '54120', '54121', '54122', '54123', '54124', '54125', '54126', '54127', '54128', '54129',
        '54130', '54131', '54132', '54133', '54134', '54135', '54136', '54137', '54138', '54139',
        '54140', '54141', '54142', '54143', '54144', '54145', '54146', '54147', '54148', '54149',
        '54150', '54151', '54152', '54153', '54154', '54155', '54156', '54157', '54158', '54159',
        '54160', '54161', '54162', '54163', '54164', '54165', '54166', '54167', '54168', '54169',
        '54170', '54171', '54172', '54173', '54174', '54175', '54176', '54177', '54178', '54179',
        '54180', '54181', '54182', '54183', '54184', '54185', '54186', '54187', '54188', '54189',
        '54190', '54191', '54192', '54193', '54194', '54195', '54196', '54197', '54198', '54199',
        '54200', '54201', '54202', '54203', '54204', '54205', '54206', '54207', '54208', '54209',
        '54210', '54211', '54212', '54213', '54214', '54215', '54216', '54217', '54218', '54219',
        '54220', '54221', '54222', '54223', '54224', '54225', '54226', '54227', '54228', '54229',
        '54230', '54231', '54232', '54233', '54234', '54235', '54236', '54237', '54238', '54239',
        '54240', '54241', '54242', '54243', '54244', '54245', '54246', '54247', '54248', '54249',
        '54250', '54251', '54252', '54253', '54254', '54255', '54256', '54257', '54258', '54259',
        '54260', '54261', '54262', '54263', '54264', '54265', '54266', '54267', '54268', '54269',
        '54270', '54271', '54272', '54273', '54274', '54275', '54276', '54277', '54278', '54279',
        '54280', '54281', '54282', '54283', '54284', '54285', '54286', '54287', '54288', '54289',
        '54290', '54291', '54292', '54293', '54294', '54295', '54296', '54297', '54298', '54299',
        '54300', '54301', '54302', '54303', '54304', '54305', '54306', '54307', '54308', '54309',
        '54310', '54311', '54312', '54313', '54314', '54315', '54316', '54317', '54318', '54319',
        '54320', '54321', '54322', '54323', '54324', '54325', '54326', '54327', '54328', '54329',
        '54330', '54331', '54332', '54333', '54334', '54335', '54336', '54337', '54338', '54339',
        '54340', '54341', '54342', '54343', '54344', '54345', '54346', '54347', '54348', '54349',
        '54350', '54351', '54352', '54353', '54354', '54355', '54356', '54357', '54358', '54359',
        '54360', '54361', '54362', '54363', '54364', '54365', '54366', '54367', '54368', '54369',
        '54370', '54371', '54372', '54373', '54374', '54375', '54376', '54377', '54378', '54379',
        '54380', '54381', '54382', '54383', '54384', '54385', '54386', '54387', '54388', '54389',
        '54390', '54391', '54392', '54393', '54394', '54395', '54396', '54397', '54398', '54399'
    ];
    
    // Pega os primeiros 5 dígitos do CEP
    const cepPrefix = cepNumber.substring(0, 5);
    
    // Verifica em qual zona o CEP está
    if (zona1.includes(cepPrefix)) {
        return { fee: 0, zone: 'Zona 1 - Piedade', distance: '0.5km' };
    } else if (zona2.includes(cepPrefix)) {
        return { fee: 3.00, zone: 'Zona 2 - Jaboatão', distance: '1.5km' };
    } else if (zona3.includes(cepPrefix)) {
        return { fee: 5.00, zone: 'Zona 3 - Recife', distance: '3.0km' };
    } else if (zona4.includes(cepPrefix)) {
        return { fee: 8.00, zone: 'Zona 4 - Outros PE', distance: '5.0km+' };
    } else {
        return { fee: 12.00, zone: 'Zona 5 - Outros Estados', distance: '10.0km+' };
    }
}

// Função para calcular a distância usando apenas CEP (sem Google Maps)
async function calculateDistance(address) {
    console.log('Calculando frete usando sistema de zonas por CEP');
    
    // Extrai o CEP do endereço
    const cepMatch = address.match(/(\d{5})-?(\d{3})/);
    if (!cepMatch) {
        console.log('CEP não encontrado no endereço, usando taxa padrão: R$ 5,00');
        return 5.0; // Retorna distância que resulta em taxa padrão
    }
    
    const cep = cepMatch[1] + cepMatch[2];
    const zoneInfo = calculateDeliveryFeeByZone(cep);
    
    console.log(`CEP ${cep} -> ${zoneInfo.zone} - Taxa: R$ ${zoneInfo.fee.toFixed(2)}`);
    
    // Retorna uma "distância" que resulta na taxa correta
    // Isso é só para manter compatibilidade com o código existente
    if (zoneInfo.fee === 0) return 0.5;
    if (zoneInfo.fee === 3.00) return 1.5;
    if (zoneInfo.fee === 5.00) return 3.0;
    if (zoneInfo.fee === 8.00) return 5.0;
    return 10.0; // Para taxa de R$ 12,00
}

// Função auxiliar para extrair CEP do endereço
function extractCepFromAddress(address) {
    const cepMatch = address.match(/(\d{5})-?(\d{3})/);
    if (cepMatch) {
        return cepMatch[1] + cepMatch[2];
    }
    return null;
}

// Função para estimar distância baseada no CEP (aproximação)
function estimateDistanceByCep(cep) {
    // CEP do restaurante: 54410-460 (Piedade, Jaboatão dos Guararapes)
    const storeCep = '54410460';
    const customerCep = cep.replace(/\D/g, '');
    
    // CEPs próximos ao restaurante (Piedade e arredores)
    const nearbyCeps = [
        '54410000', '54410001', '54410002', '54410003', '54410004',
        '54410005', '54410006', '54410007', '54410008', '54410009',
        '54410010', '54410011', '54410012', '54410013', '54410014',
        '54410015', '54410016', '54410017', '54410018', '54410019',
        '54410020', '54410021', '54410022', '54410023', '54410024',
        '54410025', '54410026', '54410027', '54410028', '54410029',
        '54410030', '54410031', '54410032', '54410033', '54410034',
        '54410035', '54410036', '54410037', '54410038', '54410039',
        '54410040', '54410041', '54410042', '54410043', '54410044',
        '54410045', '54410046', '54410047', '54410048', '54410049',
        '54410050', '54410051', '54410052', '54410053', '54410054',
        '54410055', '54410056', '54410057', '54410058', '54410059',
        '54410060', '54410061', '54410062', '54410063', '54410064',
        '54410065', '54410066', '54410067', '54410068', '54410069',
        '54410070', '54410071', '54410072', '54410073', '54410074',
        '54410075', '54410076', '54410077', '54410078', '54410079',
        '54410080', '54410081', '54410082', '54410083', '54410084',
        '54410085', '54410086', '54410087', '54410088', '54410089',
        '54410090', '54410091', '54410092', '54410093', '54410094',
        '54410095', '54410096', '54410097', '54410098', '54410099'
    ];
    
    // Verifica se o CEP está na lista de CEPs próximos
    if (nearbyCeps.some(cep => customerCep.startsWith(cep.substring(0, 5)))) {
        return 0.5; // Menos de 1km
    }
    
    // CEPs de Jaboatão dos Guararapes (outros bairros)
    if (customerCep.startsWith('544')) {
        return 1.5; // 1-2km
    }
    
    // CEPs de Recife
    if (customerCep.startsWith('50') || customerCep.startsWith('51') || customerCep.startsWith('52') || customerCep.startsWith('53')) {
        return 3.0; // 3-5km
    }
    
    // Outros CEPs de Pernambuco
    if (customerCep.startsWith('54') || customerCep.startsWith('55') || customerCep.startsWith('56')) {
        return 5.0; // 5-10km
    }
    
    // CEPs de outros estados
    return 10.0; // Mais de 10km
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
