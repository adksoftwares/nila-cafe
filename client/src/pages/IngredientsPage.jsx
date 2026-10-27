import React, { useState, useEffect } from 'react';
import {
  Layers,
  AlertTriangle,
  Plus,
  RefreshCw,
  Package,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Boxes,
  Sliders,
  Trash2,
  Edit3,
  DollarSign
} from 'lucide-react';
import { money } from '../utils/formatters.js';
import ModifierGroupModal from '../components/modals/ModifierGroupModal.jsx';

export default function IngredientsPage({ api, onFlash }) {
  const [activeTab, setActiveTab] = useState('inventory'); // 'inventory' | 'recipes' | 'modifiers'
  const [ingredients, setIngredients] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [products, setProducts] = useState([]);
  const [modifiers, setModifiers] = useState([]);
  const [loading, setLoading] = useState(true);

  // New Ingredient Form state
  const [showAddIng, setShowAddIng] = useState(false);
  const [ingName, setIngName] = useState('');
  const [ingUnit, setIngUnit] = useState('pcs');
  const [ingStock, setIngStock] = useState('');
  const [ingMinAlert, setIngMinAlert] = useState('10');
  const [ingCost, setIngCost] = useState('');
  const [submittingIng, setSubmittingIng] = useState(false);

  // Restock Form state
  const [restockingId, setRestockingId] = useState(null);
  const [restockAmount, setRestockAmount] = useState('');
  const [restockReason, setRestockReason] = useState('purchase');

  // Recipe Mapping state
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedIngredientId, setSelectedIngredientId] = useState('');
  const [recipeQtyRequired, setRecipeQtyRequired] = useState('');
  const [submittingRecipe, setSubmittingRecipe] = useState(false);

  // Modifier Modal state
  const [showModifierModal, setShowModifierModal] = useState(false);
  const [editingModifier, setEditingModifier] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ingRes, recRes, prodRes, modRes] = await Promise.all([
        api('/ingredients'),
        api('/ingredients/recipes'),
        api('/products'),
        api('/modifiers')
      ]);
      setIngredients(ingRes.ingredients || []);
      setRecipes(recRes.recipes || []);
      setProducts(prodRes.products || []);
      setModifiers(modRes.modifiers || []);
      if (prodRes.products?.length && !selectedProductId) {
        setSelectedProductId(prodRes.products[0].id);
      }
    } catch (err) {
      onFlash?.(err.message || 'Failed to load inventory data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateIngredient = async (e) => {
    e.preventDefault();
    if (!ingName.trim()) return;

    setSubmittingIng(true);
    try {
      const res = await api('/ingredients', {
        method: 'POST',
        body: JSON.stringify({
          name: ingName.trim(),
          unit: ingUnit,
          stock: Number(ingStock) || 0,
          minStockAlert: Number(ingMinAlert) || 10,
          costPerUnit: Number(ingCost) || 0
        })
      });

      if (res.ingredient) {
        setIngredients(prev => [...prev, res.ingredient]);
        onFlash?.(`Added ingredient "${res.ingredient.name}"`, 'success');
        setIngName('');
        setIngStock('');
        setIngCost('');
        setShowAddIng(false);
      }
    } catch (err) {
      onFlash?.(err.message || 'Could not add ingredient', 'error');
    } finally {
      setSubmittingIng(false);
    }
  };

  const handleRestock = async (e, id) => {
    e.preventDefault();
    const delta = Number(restockAmount);
    if (!delta || delta <= 0) return;

    try {
      const res = await api(`/ingredients/${id}/stock`, {
        method: 'PATCH',
        body: JSON.stringify({
          delta,
          reason: restockReason,
          notes: 'Inventory restock'
        })
      });

      if (res.success && res.ingredient) {
        setIngredients(prev =>
          prev.map(i => (i.id === id ? { ...i, stock: res.ingredient.stock } : i))
        );
        onFlash?.(`Restocked +${delta} ${res.ingredient.unit}`, 'success');
        setRestockingId(null);
        setRestockAmount('');
      }
    } catch (err) {
      onFlash?.(err.message || 'Restock failed', 'error');
    }
  };

  const handleCreateRecipe = async (e) => {
    e.preventDefault();
    const qty = Number(recipeQtyRequired);
    if (!selectedProductId || !selectedIngredientId || !qty || qty <= 0) return;

    setSubmittingRecipe(true);
    try {
      const res = await api('/ingredients/recipes', {
        method: 'POST',
        body: JSON.stringify({
          productId: selectedProductId,
          ingredientId: selectedIngredientId,
          quantityRequired: qty
        })
      });

      if (res.recipe) {
        onFlash?.('Recipe BOM item saved successfully', 'success');
        setRecipeQtyRequired('');
        const recRes = await api('/ingredients/recipes');
        setRecipes(recRes.recipes || []);
      }
    } catch (err) {
      onFlash?.(err.message || 'Could not save recipe BOM', 'error');
    } finally {
      setSubmittingRecipe(false);
    }
  };

  const handleDeleteRecipe = async (recipeId) => {
    try {
      const res = await api(`/ingredients/recipes/${recipeId}`, { method: 'DELETE' });
      if (res.success) {
        setRecipes(prev => prev.filter(r => r.id !== recipeId));
        onFlash?.('Ingredient removed from BOM', 'success');
      }
    } catch (err) {
      onFlash?.(err.message || 'Failed to remove recipe item', 'error');
    }
  };

  const handleSaveModifier = async (data) => {
    if (data.id) {
      const res = await api(`/modifiers/${data.id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
      if (res.success) {
        setModifiers(prev => prev.map(m => (m.id === data.id ? res.modifier : m)));
        onFlash?.('Modifier group updated successfully', 'success');
      }
    } else {
      const res = await api('/modifiers', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      if (res.success) {
        setModifiers(prev => [...prev, res.modifier]);
        onFlash?.('Modifier group created successfully', 'success');
      }
    }
  };

  const handleDeleteModifier = async (modifierId) => {
    if (!window.confirm('Are you sure you want to delete this modifier group?')) return;
    try {
      const res = await api(`/modifiers/${modifierId}`, { method: 'DELETE' });
      if (res.success) {
        setModifiers(prev => prev.filter(m => m.id !== modifierId));
        onFlash?.('Modifier group deleted', 'success');
      }
    } catch (err) {
      onFlash?.(err.message || 'Failed to delete modifier group', 'error');
    }
  };

  const lowStockIngredients = ingredients.filter(i => Number(i.stock) <= Number(i.min_stock_alert));
  const productFilteredRecipes = recipes.filter(r => r.product_id === selectedProductId);
  const selectedProduct = products.find(p => p.id === selectedProductId);

  // Compute total BOM raw cost for selected product
  const totalBOMCost = productFilteredRecipes.reduce((sum, r) => {
    const ing = ingredients.find(i => i.id === r.ingredient_id);
    const unitCost = ing ? Number(ing.cost_per_unit || 0) : 0;
    return sum + (Number(r.quantity_required) * unitCost);
  }, 0);

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">INVENTORY, RECIPES & MODIFIERS</span>
          <h1>Raw Inventory & Recipe Management</h1>
          <p>Track raw materials, link bill of materials (BOM), and configure product modifier add-ons.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            className={activeTab === 'inventory' ? 'primary-btn' : 'secondary-btn'}
            onClick={() => setActiveTab('inventory')}
          >
            <Boxes size={16} /> Raw Inventory
          </button>
          <button
            type="button"
            className={activeTab === 'recipes' ? 'primary-btn' : 'secondary-btn'}
            onClick={() => setActiveTab('recipes')}
          >
            <Layers size={16} /> Recipe (BOM)
          </button>
          <button
            type="button"
            className={activeTab === 'modifiers' ? 'primary-btn' : 'secondary-btn'}
            onClick={() => setActiveTab('modifiers')}
          >
            <Sliders size={16} /> Modifiers & Add-Ons
          </button>
        </div>
      </div>

      {/* Low Stock Warning Banner */}
      {lowStockIngredients.length > 0 && activeTab === 'inventory' && (
        <div
          style={{
            background: '#fffbeb',
            border: '1px solid #fde68a',
            padding: '12px 18px',
            borderRadius: 10,
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 12
          }}
        >
          <AlertTriangle color="#d97706" size={22} />
          <div>
            <strong style={{ color: '#92400e', fontSize: 13 }}>Low Stock Alert:</strong>
            <span style={{ color: '#b45309', fontSize: 13, marginLeft: 6 }}>
              {lowStockIngredients.map(i => `${i.name} (${i.stock} ${i.unit} left)`).join(', ')}
            </span>
          </div>
        </div>
      )}

      {/* ================= TAB 1: RAW INVENTORY ================= */}
      {activeTab === 'inventory' && (
        <div className="table-card">
          <div className="table-top">
            <div>
              <h3>Warehouse Raw Ingredients</h3>
              <span className="muted">Live stock levels linked to recipe auto-depletion</span>
            </div>
            <button
              className="primary-btn small"
              onClick={() => setShowAddIng(!showAddIng)}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Plus size={15} /> {showAddIng ? 'Cancel' : 'New Ingredient'}
            </button>
          </div>

          {/* New Ingredient Form */}
          {showAddIng && (
            <form
              onSubmit={handleCreateIngredient}
              style={{
                padding: '14px 18px',
                background: '#f8fafd',
                borderBottom: '1px solid var(--line)',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr)) 100px',
                gap: 12,
                alignItems: 'flex-end'
              }}
            >
              <div>
                <label style={{ fontSize: 11, fontWeight: 600 }}>Name: *</label>
                <input
                  type="text"
                  placeholder="e.g. Arabica Coffee Beans"
                  value={ingName}
                  onChange={e => setIngName(e.target.value)}
                  required
                  style={{ width: '100%', padding: '6px 10px', fontSize: 12, borderRadius: 6, border: '1px solid #cbd5e1' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600 }}>Unit:</label>
                <select
                  value={ingUnit}
                  onChange={e => setIngUnit(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', fontSize: 12, borderRadius: 6, border: '1px solid #cbd5e1' }}
                >
                  <option value="pcs">Pieces (pcs)</option>
                  <option value="g">Grams (g)</option>
                  <option value="kg">Kilograms (kg)</option>
                  <option value="ml">Milliliters (ml)</option>
                  <option value="L">Liters (L)</option>
                  <option value="shots">Shots</option>
                  <option value="slices">Slices</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600 }}>Opening Stock:</label>
                <input
                  type="number"
                  step="any"
                  placeholder="0"
                  value={ingStock}
                  onChange={e => setIngStock(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', fontSize: 12, borderRadius: 6, border: '1px solid #cbd5e1' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600 }}>Min Stock Alert:</label>
                <input
                  type="number"
                  step="any"
                  placeholder="10"
                  value={ingMinAlert}
                  onChange={e => setIngMinAlert(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', fontSize: 12, borderRadius: 6, border: '1px solid #cbd5e1' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600 }}>Cost / Unit (LKR):</label>
                <input
                  type="number"
                  step="any"
                  placeholder="0"
                  value={ingCost}
                  onChange={e => setIngCost(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', fontSize: 12, borderRadius: 6, border: '1px solid #cbd5e1' }}
                />
              </div>
              <button
                type="submit"
                className="primary-btn"
                disabled={submittingIng}
                style={{ padding: '7px 12px', fontSize: 12 }}
              >
                Save
              </button>
            </form>
          )}

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>INGREDIENT NAME</th>
                  <th>UNIT</th>
                  <th>CURRENT STOCK</th>
                  <th>MIN ALERT</th>
                  <th>EST. UNIT COST</th>
                  <th>STATUS</th>
                  <th style={{ textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {ingredients.map(ing => {
                  const isLow = Number(ing.stock) <= Number(ing.min_stock_alert);
                  const isRestocking = restockingId === ing.id;

                  return (
                    <tr key={ing.id}>
                      <td>
                        <strong>{ing.name}</strong>
                      </td>
                      <td>
                        <span className="pill" style={{ background: '#f1f5f9' }}>{ing.unit}</span>
                      </td>
                      <td>
                        <strong style={{ color: isLow ? '#dc2626' : '#1e293b', fontSize: 14 }}>
                          {Number(ing.stock).toLocaleString()} {ing.unit}
                        </strong>
                      </td>
                      <td>{ing.min_stock_alert} {ing.unit}</td>
                      <td>{money(ing.cost_per_unit)}</td>
                      <td>
                        {isLow ? (
                          <span className="pill" style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <AlertCircle size={12} /> Low Stock
                          </span>
                        ) : (
                          <span className="pill" style={{ background: '#dcfce7', color: '#16a34a', border: '1px solid #bbf7d0', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <CheckCircle2 size={12} /> Adequate
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {isRestocking ? (
                          <form onSubmit={(e) => handleRestock(e, ing.id)} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                            <input
                              type="number"
                              step="any"
                              min="0.1"
                              placeholder={`+${ing.unit}`}
                              value={restockAmount}
                              onChange={e => setRestockAmount(e.target.value)}
                              autoFocus
                              style={{ width: 80, padding: '4px 6px', fontSize: 12, borderRadius: 4, border: '1px solid #cbd5e1' }}
                            />
                            <button type="submit" className="primary-btn small" style={{ padding: '4px 8px' }}>
                              Add
                            </button>
                            <button type="button" className="secondary-btn small" onClick={() => setRestockingId(null)} style={{ padding: '4px 8px' }}>
                              Cancel
                            </button>
                          </form>
                        ) : (
                          <button
                            type="button"
                            className="secondary-btn small"
                            onClick={() => {
                              setRestockingId(ing.id);
                              setRestockAmount('');
                            }}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          >
                            <RefreshCw size={12} /> Restock
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB 2: RECIPE (BOM) ================= */}
      {activeTab === 'recipes' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20 }}>
          {/* Products Selector */}
          <div className="table-card" style={{ padding: 16 }}>
            <h3 style={{ marginBottom: 12, fontSize: 14 }}>Select Menu Product</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {products.map(p => {
                const isSelected = p.id === selectedProductId;
                const recCount = recipes.filter(r => r.product_id === p.id).length;

                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedProductId(p.id)}
                    style={{
                      textAlign: 'left',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: isSelected ? '2px solid var(--blue)' : '1px solid #e2e8f0',
                      background: isSelected ? '#eff6ff' : '#fff',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: 13, display: 'block', color: isSelected ? '#1d4ed8' : '#1e293b' }}>
                        {p.name}
                      </strong>
                      <span style={{ fontSize: 11, color: '#64748b' }}>Code: {p.code}</span>
                    </div>
                    <span
                      className="pill"
                      style={{
                        fontSize: 10,
                        background: recCount > 0 ? '#e0f2fe' : '#f1f5f9',
                        color: recCount > 0 ? '#0369a1' : '#64748b'
                      }}
                    >
                      {recCount} {recCount === 1 ? 'ingredient' : 'ingredients'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Product Recipe BOM Inspector & Assignment */}
          <div className="table-card">
            <div className="table-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3>Recipe Breakdown (BOM) for {selectedProduct?.name || 'Item'}</h3>
                <span className="muted">
                  Auto-depleted from inventory whenever this item is ordered
                </span>
              </div>
              {selectedProduct && (
                <div style={{ textAlign: 'right', fontSize: '11px', color: '#475569' }}>
                  <span>Est. BOM Cost: <strong style={{ color: '#0f172a' }}>{money(totalBOMCost)}</strong></span>
                  <span style={{ margin: '0 6px' }}>|</span>
                  <span>Selling Price: <strong style={{ color: '#16a34a' }}>{money(selectedProduct.takeaway_price)}</strong></span>
                </div>
              )}
            </div>

            {/* Add Recipe Item Form */}
            <form
              onSubmit={handleCreateRecipe}
              style={{
                padding: '14px 18px',
                background: '#f8fafd',
                borderBottom: '1px solid var(--line)',
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 100px',
                gap: 12,
                alignItems: 'flex-end'
              }}
            >
              <div>
                <label style={{ fontSize: 11, fontWeight: 600 }}>Raw Ingredient:</label>
                <select
                  value={selectedIngredientId}
                  onChange={e => setSelectedIngredientId(e.target.value)}
                  required
                  style={{ width: '100%', padding: '6px 10px', fontSize: 12, borderRadius: 6, border: '1px solid #cbd5e1' }}
                >
                  <option value="">-- Choose Ingredient --</option>
                  {ingredients.map(ing => (
                    <option key={ing.id} value={ing.id}>
                      {ing.name} ({ing.unit}) — Current Stock: {ing.stock}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600 }}>Qty Required / Unit:</label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  placeholder="e.g. 1 or 150"
                  value={recipeQtyRequired}
                  onChange={e => setRecipeQtyRequired(e.target.value)}
                  required
                  style={{ width: '100%', padding: '6px 10px', fontSize: 12, borderRadius: 6, border: '1px solid #cbd5e1' }}
                />
              </div>
              <button
                type="submit"
                className="primary-btn"
                disabled={submittingRecipe}
                style={{ padding: '7px 12px', fontSize: 12 }}
              >
                Add to BOM
              </button>
            </form>

            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>RAW INGREDIENT</th>
                    <th>QTY REQUIRED / SERVING</th>
                    <th>CURRENT WAREHOUSE STOCK</th>
                    <th>DEPLETION STATUS</th>
                    <th style={{ textAlign: 'right' }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {productFilteredRecipes.map(r => {
                    const ing = ingredients.find(i => i.id === r.ingredient_id);
                    const stock = ing ? Number(ing.stock) : Number(r.current_stock || 0);
                    const req = Number(r.quantity_required);
                    const canMake = req > 0 ? Math.floor(stock / req) : 0;

                    return (
                      <tr key={r.id}>
                        <td>
                          <strong>{r.ingredient_name || ing?.name}</strong>
                        </td>
                        <td>
                          <span className="pill" style={{ background: '#f1f5f9', fontWeight: 600 }}>
                            {req} {r.unit || ing?.unit}
                          </span>
                        </td>
                        <td>
                          {stock} {r.unit || ing?.unit}
                        </td>
                        <td>
                          <span style={{ fontSize: 12, color: canMake < 10 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                            Yields ~{canMake} servings
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={() => handleDeleteRecipe(r.id)}
                            title="Remove from BOM"
                            style={{
                              background: 'transparent',
                              border: 0,
                              color: '#ef4444',
                              cursor: 'pointer',
                              padding: '4px'
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {!productFilteredRecipes.length && (
                <div className="empty-state" style={{ padding: '30px 20px', textAlign: 'center', color: '#94a3b8' }}>
                  No raw ingredients mapped to this product yet. Add an ingredient above to enable automatic recipe stock depletion.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 3: MODIFIERS & ADD-ONS ================= */}
      {activeTab === 'modifiers' && (
        <div className="table-card">
          <div className="table-top">
            <div>
              <h3>Product Modifier Groups & Add-Ons</h3>
              <span className="muted">Configure customer choices (milk, toppings, doneness) with pricing and BOM ingredient depletion</span>
            </div>
            <button
              type="button"
              className="primary-btn small"
              onClick={() => {
                setEditingModifier(null);
                setShowModifierModal(true);
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Plus size={15} /> Create Modifier Group
            </button>
          </div>

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>MODIFIER GROUP</th>
                  <th>ASSIGNED PRODUCT</th>
                  <th>SELECTION TYPE</th>
                  <th>REQUIRED</th>
                  <th>AVAILABLE OPTIONS & PRICES</th>
                  <th style={{ textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {modifiers.map(mod => {
                  const targetProd = products.find(p => p.id === mod.product_id);

                  return (
                    <tr key={mod.id}>
                      <td>
                        <strong style={{ fontSize: '13px', color: '#0f172a' }}>{mod.name}</strong>
                      </td>
                      <td>
                        {targetProd ? (
                          <span style={{ fontSize: '12px', fontWeight: 600, color: '#2563eb' }}>
                            {targetProd.name} ({targetProd.code})
                          </span>
                        ) : (
                          <span className="pill" style={{ background: '#f1f5f9', color: '#475569' }}>
                            All Products (Global)
                          </span>
                        )}
                      </td>
                      <td>
                        <span
                          className="pill"
                          style={{
                            background: mod.type === 'single' ? '#eff6ff' : '#f0fdf4',
                            color: mod.type === 'single' ? '#1d4ed8' : '#15803d',
                            fontWeight: 'bold'
                          }}
                        >
                          {mod.type === 'single' ? 'Pick 1 (Single)' : 'Add Any (Multiple)'}
                        </span>
                      </td>
                      <td>
                        {mod.required ? (
                          <span className="pill" style={{ background: '#fef2f2', color: '#b91c1c', fontWeight: 'bold' }}>
                            Yes (Mandatory)
                          </span>
                        ) : (
                          <span className="pill" style={{ background: '#f8fafc', color: '#64748b' }}>
                            Optional
                          </span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {Array.isArray(mod.options) && mod.options.map((opt, idx) => (
                            <span
                              key={opt.id || idx}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: '#f1f5f9',
                                border: '1px solid #e2e8f0',
                                padding: '2px 8px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                color: '#1e293b'
                              }}
                            >
                              <strong>{opt.name}</strong>
                              {Number(opt.price) > 0 && (
                                <span style={{ color: '#16a34a', fontWeight: 'bold' }}>
                                  +{money(opt.price)}
                                </span>
                              )}
                              {opt.ingredient_id && (
                                <span style={{ color: '#64748b', fontSize: '9px' }}>
                                  [BOM: {opt.ingredient_qty}]
                                </span>
                              )}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '8px' }}>
                          <button
                            type="button"
                            className="secondary-btn small"
                            onClick={() => {
                              setEditingModifier(mod);
                              setShowModifierModal(true);
                            }}
                            title="Edit group"
                            style={{ padding: '4px 8px' }}
                          >
                            <Edit3 size={13} /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteModifier(mod.id)}
                            title="Delete group"
                            style={{
                              background: 'transparent',
                              border: 0,
                              color: '#ef4444',
                              cursor: 'pointer',
                              padding: '4px'
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {!modifiers.length && (
              <div className="empty-state" style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8' }}>
                No modifier groups configured yet. Click "Create Modifier Group" above to add customizations like milk choices, extra toppings, or size upgrades.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modifier Group Create / Edit Modal */}
      {showModifierModal && (
        <ModifierGroupModal
          modifier={editingModifier}
          products={products}
          ingredients={ingredients}
          onSave={handleSaveModifier}
          onClose={() => {
            setShowModifierModal(false);
            setEditingModifier(null);
          }}
          onFlash={onFlash}
        />
      )}
    </>
  );
}
