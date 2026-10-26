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
  Boxes
} from 'lucide-react';
import { money } from '../utils/formatters.js';

export default function IngredientsPage({ api, onFlash }) {
  const [activeTab, setActiveTab] = useState('inventory'); // 'inventory' | 'recipes'
  const [ingredients, setIngredients] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [products, setProducts] = useState([]);
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

  const loadData = async () => {
    setLoading(true);
    try {
      const [ingRes, recRes, prodRes] = await Promise.all([
        api('/ingredients'),
        api('/ingredients/recipes'),
        api('/products')
      ]);
      setIngredients(ingRes.ingredients || []);
      setRecipes(recRes.recipes || []);
      setProducts(prodRes.products || []);
      if (prodRes.products?.length && !selectedProductId) {
        setSelectedProductId(prodRes.products[0].id);
      }
    } catch (err) {
      onFlash?.(err.message || 'Failed to load ingredients', 'error');
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
        // Reload recipes to display updated join names
        const recRes = await api('/ingredients/recipes');
        setRecipes(recRes.recipes || []);
      }
    } catch (err) {
      onFlash?.(err.message || 'Could not save recipe BOM', 'error');
    } finally {
      setSubmittingRecipe(false);
    }
  };

  const lowStockIngredients = ingredients.filter(i => Number(i.stock) <= Number(i.min_stock_alert));
  const productFilteredRecipes = recipes.filter(r => r.product_id === selectedProductId);

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">INVENTORY & BILL OF MATERIALS (BOM)</span>
          <h1>Raw Ingredients & Recipes</h1>
          <p>Track raw materials, automate recipe depletion on sales, and manage low-stock alerts.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className={activeTab === 'inventory' ? 'primary-btn' : 'secondary-btn'}
            onClick={() => setActiveTab('inventory')}
          >
            <Boxes size={16} /> Raw Inventory
          </button>
          <button
            className={activeTab === 'recipes' ? 'primary-btn' : 'secondary-btn'}
            onClick={() => setActiveTab('recipes')}
          >
            <Layers size={16} /> Recipe (BOM)
          </button>
        </div>
      </div>

      {/* Low Stock Warning Banner */}
      {lowStockIngredients.length > 0 && (
        <div style={{
          background: '#fffbeb',
          border: '1px solid #fde68a',
          padding: '12px 18px',
          borderRadius: 10,
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 12
        }}>
          <AlertTriangle color="#d97706" size={22} />
          <div>
            <strong style={{ color: '#92400e', fontSize: 13 }}>Low Stock Alert:</strong>
            <span style={{ color: '#b45309', fontSize: 13, marginLeft: 6 }}>
              {lowStockIngredients.map(i => `${i.name} (${i.stock} ${i.unit} left)`).join(', ')}
            </span>
          </div>
        </div>
      )}

      {activeTab === 'inventory' ? (
        <div className="table-card">
          <div className="table-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3>Ingredients Stock List</h3>
              <span className="muted">{ingredients.length} items tracked for recipe depletion</span>
            </div>
            <button
              className="primary-btn small"
              onClick={() => setShowAddIng(!showAddIng)}
            >
              <Plus size={15} /> {showAddIng ? 'Close Form' : 'New Ingredient'}
            </button>
          </div>

          {/* New Ingredient Form */}
          {showAddIng && (
            <form onSubmit={handleCreateIngredient} style={{
              padding: '16px 20px',
              background: '#f8fafd',
              borderBottom: '1px solid var(--line)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr)) 100px',
              gap: 12,
              alignItems: 'flex-end'
            }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600 }}>Name:</label>
                <input
                  type="text"
                  placeholder="e.g. Fresh Milk"
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
                  <option value="pcs">pcs (Pieces)</option>
                  <option value="g">g (Grams)</option>
                  <option value="ml">ml (Milliliters)</option>
                  <option value="kg">kg (Kilograms)</option>
                  <option value="l">l (Liters)</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600 }}>Initial Stock:</label>
                <input
                  type="number"
                  step="any"
                  min="0"
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
                  min="0"
                  value={ingMinAlert}
                  onChange={e => setIngMinAlert(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', fontSize: 12, borderRadius: 6, border: '1px solid #cbd5e1' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600 }}>Cost/Unit (LKR):</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0.00"
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
      ) : (
        /* Bill of Materials (BOM) Tab */
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
                    onClick={() => setSelectedProductId(p.id)}
                    style={{
                      textAlign: 'left',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: isSelected ? '2px solid var(--accent)' : '1px solid #e2e8f0',
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
                    <span className="pill" style={{ fontSize: 10, background: recCount > 0 ? '#e0f2fe' : '#f1f5f9', color: recCount > 0 ? '#0369a1' : '#64748b' }}>
                      {recCount} {recCount === 1 ? 'ingredient' : 'ingredients'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Product Recipe BOM Inspector & Assignment */}
          <div className="table-card">
            <div className="table-top">
              <div>
                <h3>Recipe Breakdown (BOM)</h3>
                <span className="muted">
                  Auto-depleted from inventory whenever this item is ordered
                </span>
              </div>
            </div>

            {/* Add Recipe Item Form */}
            <form onSubmit={handleCreateRecipe} style={{
              padding: '14px 18px',
              background: '#f8fafd',
              borderBottom: '1px solid var(--line)',
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 100px',
              gap: 12,
              alignItems: 'flex-end'
            }}>
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
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {!productFilteredRecipes.length && (
                <div className="empty-state" style={{ padding: '30px 20px' }}>
                  No raw ingredients mapped to this product yet. Add an ingredient above to enable automatic recipe stock depletion.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
