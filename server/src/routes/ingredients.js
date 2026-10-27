import { Router } from 'express';
import { query, pool } from '../db.js';
import {
  demoIngredients,
  demoRecipes,
  demoIngredientMovements
} from '../state.js';
import { auth, roles } from '../middleware/auth.js';
import { recordAuditEvent } from '../utils/audit.js';

const router = Router();

// Ingredients: List All Raw Ingredients with Low-Stock Indicator
router.get('/', auth, async (req, res) => {
  try {
    if (pool) {
      const rows = await query(
        `SELECT id, name, unit, stock, min_stock_alert, cost_per_unit, active, created_at,
                (stock <= min_stock_alert) AS is_low_stock
         FROM ingredients
         WHERE shop_id = $1 AND active = true
         ORDER BY name ASC`,
        [req.user.shop_id],
        req.user
      );
      return res.json({ ingredients: rows });
    }

    const list = demoIngredients
      .filter(i => i.shop_id === req.user.shop_id && i.active)
      .map(i => ({
        ...i,
        is_low_stock: Number(i.stock) <= Number(i.min_stock_alert)
      }));
    res.json({ ingredients: list });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Ingredients: Create New Raw Ingredient
router.post('/', auth, roles('owner', 'manager'), async (req, res) => {
  const { name, unit = 'pcs', stock = 0, minStockAlert = 10, costPerUnit = 0 } = req.body;
  const cleanName = String(name || '').trim();
  const cleanUnit = String(unit || 'pcs').trim().toLowerCase();
  const initialStock = Math.max(0, Number(stock) || 0);
  const minAlert = Math.max(0, Number(minStockAlert) || 0);
  const cost = Math.max(0, Number(costPerUnit) || 0);

  if (!cleanName) {
    return res.status(400).json({ error: 'Ingredient name is required.' });
  }

  try {
    if (pool) {
      const rows = await query(
        `INSERT INTO ingredients(shop_id, name, unit, stock, min_stock_alert, cost_per_unit)
         VALUES($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [req.user.shop_id, cleanName, cleanUnit, initialStock, minAlert, cost],
        req.user
      );
      return res.status(201).json({ ingredient: rows[0] });
    }

    const existing = demoIngredients.find(
      i => i.shop_id === req.user.shop_id && i.name.toLowerCase() === cleanName.toLowerCase()
    );
    if (existing) {
      return res.status(409).json({ error: 'An ingredient with this name already exists.' });
    }

    const newIng = {
      id: 'ing-' + Date.now(),
      shop_id: req.user.shop_id,
      name: cleanName,
      unit: cleanUnit,
      stock: initialStock,
      min_stock_alert: minAlert,
      cost_per_unit: cost,
      active: true,
      created_at: new Date().toISOString()
    };
    demoIngredients.push(newIng);
    res.status(201).json({ ingredient: newIng });
  } catch (e) {
    res.status(e.code === '23505' ? 409 : 500).json({
      error: e.code === '23505' ? 'An ingredient with this name already exists.' : e.message
    });
  }
});

// Ingredients: Restock or Manual Inventory Adjustment
router.patch('/:id/stock', auth, roles('owner', 'manager'), async (req, res) => {
  const ingredientId = req.params.id;
  const { delta, reason = 'purchase', notes = '' } = req.body;
  const deltaQty = Number(delta);

  if (!Number.isFinite(deltaQty) || deltaQty === 0) {
    return res.status(400).json({ error: 'Provide a non-zero adjustment delta.' });
  }

  try {
    if (pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query("SELECT set_config('app.current_shop_id', $1, true)", [req.user.shop_id]);

        const ingRows = (await client.query(
          'SELECT * FROM ingredients WHERE id = $1 AND shop_id = $2 FOR UPDATE',
          [ingredientId, req.user.shop_id]
        )).rows;

        if (!ingRows.length) throw new Error('Ingredient not found.');
        const ing = ingRows[0];
        const newStock = Math.max(0, Math.round((Number(ing.stock) + deltaQty) * 100) / 100);

        const updated = (await client.query(
          'UPDATE ingredients SET stock = $1 WHERE id = $2 RETURNING *',
          [newStock, ing.id]
        )).rows[0];

        await client.query(
          `INSERT INTO ingredient_movements(shop_id, ingredient_id, delta_qty, reason, reference_id)
           VALUES($1, $2, $3, $4, $5)`,
          [req.user.shop_id, ing.id, deltaQty, reason === 'purchase' ? 'purchase' : 'manual_adjustment', String(notes).trim() || null]
        );

        await client.query('COMMIT');
        await recordAuditEvent({
          shopId: req.user.shop_id,
          userId: req.user.sub,
          userName: req.user.name,
          userRole: req.user.role,
          action: 'INGREDIENT_RESTOCK',
          entityType: 'ingredient',
          entityId: ing.id,
          details: { ingredientName: ing.name, deltaQty, unit: ing.unit, reason }
        });
        return res.json({ success: true, ingredient: updated });
      } catch (err) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: err.message });
      } finally {
        client.release();
      }
    }

    const ing = demoIngredients.find(i => i.id === ingredientId && i.shop_id === req.user.shop_id);
    if (!ing) return res.status(404).json({ error: 'Ingredient not found.' });

    ing.stock = Math.max(0, Math.round((Number(ing.stock) + deltaQty) * 100) / 100);
    demoIngredientMovements.push({
      id: 'mov-' + Date.now(),
      shop_id: req.user.shop_id,
      ingredient_id: ing.id,
      delta_qty: deltaQty,
      reason: reason === 'purchase' ? 'purchase' : 'manual_adjustment',
      reference_id: notes || null,
      created_at: new Date().toISOString()
    });

    await recordAuditEvent({
      shopId: req.user.shop_id,
      userId: req.user.sub,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'INGREDIENT_RESTOCK',
      entityType: 'ingredient',
      entityId: ing.id,
      details: { ingredientName: ing.name, deltaQty, unit: ing.unit, reason }
    });

    res.json({ success: true, ingredient: ing });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Recipes / BOM: Get Recipe Mappings
router.get('/recipes', auth, async (req, res) => {
  const { productId } = req.query;

  try {
    if (pool) {
      const filter = productId ? 'WHERE r.shop_id = $1 AND r.product_id = $2' : 'WHERE r.shop_id = $1';
      const args = productId ? [req.user.shop_id, productId] : [req.user.shop_id];

      const rows = await query(
        `SELECT r.id, r.product_id, r.ingredient_id, r.quantity_required,
                i.name AS ingredient_name, i.unit, i.stock AS current_stock,
                p.name AS product_name, p.code AS product_code
         FROM recipe_items r
         JOIN ingredients i ON i.id = r.ingredient_id
         JOIN products p ON p.id = r.product_id
         ${filter}
         ORDER BY p.name ASC, i.name ASC`,
        args,
        req.user
      );
      return res.json({ recipes: rows });
    }

    let list = demoRecipes.filter(r => r.shop_id === req.user.shop_id);
    if (productId) {
      list = list.filter(r => r.product_id === productId);
    }
    res.json({ recipes: list });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Recipes / BOM: Create or Update Recipe Item
router.post('/recipes', auth, roles('owner', 'manager'), async (req, res) => {
  const { productId, ingredientId, quantityRequired } = req.body;
  const qty = Number(quantityRequired);

  if (!productId || !ingredientId || !Number.isFinite(qty) || qty <= 0) {
    return res.status(400).json({ error: 'Valid productId, ingredientId, and positive quantityRequired are required.' });
  }

  try {
    if (pool) {
      const rows = await query(
        `INSERT INTO recipe_items(shop_id, product_id, ingredient_id, quantity_required)
         VALUES($1, $2, $3, $4)
         ON CONFLICT (product_id, ingredient_id)
         DO UPDATE SET quantity_required = EXCLUDED.quantity_required
         RETURNING *`,
        [req.user.shop_id, productId, ingredientId, qty],
        req.user
      );
      return res.status(201).json({ recipe: rows[0] });
    }

    const ing = demoIngredients.find(i => i.id === ingredientId);
    let recipe = demoRecipes.find(r => r.product_id === productId && r.ingredient_id === ingredientId);
    if (recipe) {
      recipe.quantity_required = qty;
    } else {
      recipe = {
        id: 'rec-' + Date.now(),
        shop_id: req.user.shop_id,
        product_id: productId,
        ingredient_id: ingredientId,
        ingredient_name: ing?.name || 'Raw Ingredient',
        unit: ing?.unit || 'pcs',
        quantity_required: qty
      };
      demoRecipes.push(recipe);
    }

    res.status(201).json({ recipe });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Recipes / BOM: Delete Recipe Item from BOM
router.delete('/recipes/:id', auth, roles('owner', 'manager'), async (req, res) => {
  const { id } = req.params;

  try {
    if (pool) {
      const result = await query(
        'DELETE FROM recipe_items WHERE id = $1 AND shop_id = $2 RETURNING id',
        [id, req.user.shop_id],
        req.user
      );
      if (!result.length) {
        return res.status(404).json({ error: 'Recipe item not found.' });
      }
      await recordAuditEvent({
        shopId: req.user.shop_id,
        userId: req.user.sub,
        userName: req.user.name,
        userRole: req.user.role,
        action: 'RECIPE_BOM_DELETE',
        category: 'inventory',
        severity: 'warning',
        entityType: 'recipe',
        entityId: id,
        details: { recipeId: id }
      });
      return res.json({ success: true, message: 'Recipe item removed from BOM.' });
    }

    const idx = demoRecipes.findIndex(r => r.id === id && r.shop_id === req.user.shop_id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Recipe item not found.' });
    }
    const removedRecipe = demoRecipes[idx];
    demoRecipes.splice(idx, 1);
    await recordAuditEvent({
      shopId: req.user.shop_id,
      userId: req.user.sub,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'RECIPE_BOM_DELETE',
      category: 'inventory',
      severity: 'warning',
      entityType: 'recipe',
      entityId: id,
      details: {
        recipeId: id,
        product_id: removedRecipe.product_id,
        ingredient_name: removedRecipe.ingredient_name
      }
    });
    res.json({ success: true, message: 'Recipe item removed from BOM.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
