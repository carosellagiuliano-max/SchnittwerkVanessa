'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import {
  Search,
  Plus,
  MoreHorizontal,
  Package,
  Edit,
  Trash2,
  Eye,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { createBrowserClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

// ============================================
// TYPES
// ============================================

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_cents: number;
  compare_at_price_cents: number | null;
  stock_quantity: number;
  sku: string | null;
  category: string | null;
  is_active: boolean;
  image_url: string | null;
  created_at: string;
}

interface Category {
  id: string;
  name: string;
}

interface AdminProductListProps {
  products: Product[];
  total: number;
  page: number;
  limit: number;
  categories: Category[];
  initialSearch: string;
  initialCategory: string;
}

interface ProductForm {
  name: string;
  description: string;
  sku: string;
  price: string;
  compareAtPrice: string;
  stockQuantity: string;
  category: string;
  isActive: boolean;
}

const DEFAULT_SALON_ID = '550e8400-e29b-41d4-a716-446655440001';

// ============================================
// HELPERS
// ============================================

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: 'CHF',
  }).format(cents / 100);
}

// ============================================
// ADMIN PRODUCT LIST
// ============================================

export function AdminProductList({
  products,
  total,
  page,
  limit,
  categories,
  initialSearch,
  initialCategory,
}: AdminProductListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(initialSearch);
  const [category, setCategory] = useState(initialCategory);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Create/Edit product state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState<ProductForm>({
    name: '',
    description: '',
    sku: '',
    price: '',
    compareAtPrice: '',
    stockQuantity: '0',
    category: '',
    isActive: true,
  });

  const totalPages = Math.ceil(total / limit);

  // Open view dialog
  const handleViewProduct = (product: Product) => {
    setSelectedProduct(product);
    setViewDialogOpen(true);
  };

  // Open edit dialog
  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      description: product.description || '',
      sku: product.sku || '',
      price: (product.price_cents / 100).toFixed(2),
      compareAtPrice: product.compare_at_price_cents
        ? (product.compare_at_price_cents / 100).toFixed(2)
        : '',
      stockQuantity: product.stock_quantity.toString(),
      category: product.category || '',
      isActive: product.is_active,
    });
    setEditDialogOpen(true);
  };

  // Generate slug from name
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[äÄ]/g, 'ae')
      .replace(/[öÖ]/g, 'oe')
      .replace(/[üÜ]/g, 'ue')
      .replace(/[ß]/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  // Reset form
  const resetProductForm = () => {
    setProductForm({
      name: '',
      description: '',
      sku: '',
      price: '',
      compareAtPrice: '',
      stockQuantity: '0',
      category: '',
      isActive: true,
    });
  };

  // Create product handler
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!productForm.name.trim()) {
      toast.error('Bitte geben Sie einen Produktnamen ein');
      return;
    }

    if (!productForm.price || parseFloat(productForm.price) <= 0) {
      toast.error('Bitte geben Sie einen gültigen Preis ein');
      return;
    }

    setIsSaving(true);

    try {
      const supabase = createBrowserClient();
      const priceCents = Math.round(parseFloat(productForm.price) * 100);
      const compareAtPriceCents = productForm.compareAtPrice
        ? Math.round(parseFloat(productForm.compareAtPrice) * 100)
        : null;
      const stockQuantity = parseInt(productForm.stockQuantity) || 0;
      const slug = generateSlug(productForm.name);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('products') as any).insert({
        salon_id: DEFAULT_SALON_ID,
        name: productForm.name.trim(),
        slug: slug + '-' + Date.now(), // Add timestamp to ensure uniqueness
        description: productForm.description.trim() || null,
        sku: productForm.sku.trim() || null,
        price_cents: priceCents,
        compare_at_price_cents: compareAtPriceCents,
        stock_quantity: stockQuantity,
        is_active: productForm.isActive,
      });

      if (error) throw error;

      toast.success('Produkt erfolgreich erstellt');
      setCreateDialogOpen(false);
      resetProductForm();
      router.refresh();
    } catch (error) {
      console.error('Error creating product:', error);
      toast.error('Fehler beim Erstellen des Produkts');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams);
    if (search) {
      params.set('search', search);
    } else {
      params.delete('search');
    }
    params.set('page', '1');
    router.push(`/admin/produkte?${params.toString()}`);
  };

  const handleCategoryChange = (value: string) => {
    setCategory(value);
    const params = new URLSearchParams(searchParams);
    if (value && value !== 'all') {
      params.set('category', value);
    } else {
      params.delete('category');
    }
    params.set('page', '1');
    router.push(`/admin/produkte?${params.toString()}`);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', newPage.toString());
    router.push(`/admin/produkte?${params.toString()}`);
  };

  const handleDeleteClick = (product: Product) => {
    setSelectedProduct(product);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedProduct) return;

    setIsDeleting(true);
    try {
      const supabase = createBrowserClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('products') as any)
        .delete()
        .eq('id', selectedProduct.id);

      if (error) throw error;

      toast.success('Produkt erfolgreich gelöscht');
      setDeleteDialogOpen(false);
      setSelectedProduct(null);
      router.refresh();
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Fehler beim Löschen des Produkts');
    } finally {
      setIsDeleting(false);
    }
  };

  // Update product handler
  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingProduct) return;

    if (!productForm.name.trim()) {
      toast.error('Bitte geben Sie einen Produktnamen ein');
      return;
    }

    if (!productForm.price || parseFloat(productForm.price) <= 0) {
      toast.error('Bitte geben Sie einen gültigen Preis ein');
      return;
    }

    setIsSaving(true);

    try {
      const supabase = createBrowserClient();
      const priceCents = Math.round(parseFloat(productForm.price) * 100);
      const compareAtPriceCents = productForm.compareAtPrice
        ? Math.round(parseFloat(productForm.compareAtPrice) * 100)
        : null;
      const stockQuantity = parseInt(productForm.stockQuantity) || 0;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('products') as any)
        .update({
          name: productForm.name.trim(),
          description: productForm.description.trim() || null,
          sku: productForm.sku.trim() || null,
          price_cents: priceCents,
          compare_at_price_cents: compareAtPriceCents,
          stock_quantity: stockQuantity,
          is_active: productForm.isActive,
        })
        .eq('id', editingProduct.id);

      if (error) throw error;

      toast.success('Produkt erfolgreich aktualisiert');
      setEditDialogOpen(false);
      setEditingProduct(null);
      resetProductForm();
      router.refresh();
    } catch (error) {
      console.error('Error updating product:', error);
      toast.error('Fehler beim Aktualisieren des Produkts');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {total} Produkte insgesamt
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Suchen..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 w-48"
              />
            </div>
            <Button type="submit" variant="secondary">
              Suchen
            </Button>
          </form>
          {categories.length > 0 && (
            <Select value={category} onValueChange={handleCategoryChange}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Kategorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Kategorien</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Neues Produkt
          </Button>
        </div>
      </div>

      {/* Products Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">Bild</TableHead>
                <TableHead>Produkt</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Kategorie</TableHead>
                <TableHead className="text-right">Preis</TableHead>
                <TableHead className="text-center">Bestand</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <Package className="h-8 w-8 text-muted-foreground" />
                      <p className="text-muted-foreground">
                        Keine Produkte gefunden
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div className="h-10 w-10 rounded-md overflow-hidden bg-muted flex items-center justify-center">
                        {product.image_url ? (
                          <Image
                            src={product.image_url}
                            alt={product.name}
                            width={40}
                            height={40}
                            className="object-cover"
                          />
                        ) : (
                          <ImageIcon className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{product.name}</p>
                        {product.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {product.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {product.sku || '-'}
                    </TableCell>
                    <TableCell>
                      {product.category && (
                        <Badge variant="secondary">{product.category}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div>
                        <p className="font-medium">
                          {formatCurrency(product.price_cents)}
                        </p>
                        {product.compare_at_price_cents && (
                          <p className="text-xs text-muted-foreground line-through">
                            {formatCurrency(product.compare_at_price_cents)}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={
                          product.stock_quantity <= 0
                            ? 'destructive'
                            : product.stock_quantity <= 5
                              ? 'secondary'
                              : 'outline'
                        }
                      >
                        {product.stock_quantity}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={product.is_active ? 'default' : 'outline'}>
                        {product.is_active ? 'Aktiv' : 'Inaktiv'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewProduct(product)}>
                            <Eye className="h-4 w-4 mr-2" />
                            Anzeigen
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEditProduct(product)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Bearbeiten
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDeleteClick(product)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Löschen
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Seite {page} von {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              disabled={page <= 1}
              onClick={() => handlePageChange(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              disabled={page >= totalPages}
              onClick={() => handlePageChange(page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Produkt löschen</DialogTitle>
            <DialogDescription>
              Sind Sie sicher, dass Sie &quot;{selectedProduct?.name}&quot;
              löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={isDeleting}>
              Abbrechen
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} disabled={isDeleting}>
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Lösche...
                </>
              ) : (
                'Löschen'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Product Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Produktdetails</DialogTitle>
          </DialogHeader>
          {selectedProduct && (
            <div className="space-y-4">
              {/* Product Image */}
              <div className="flex justify-center">
                <div className="h-32 w-32 rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                  {selectedProduct.image_url ? (
                    <Image
                      src={selectedProduct.image_url}
                      alt={selectedProduct.name}
                      width={128}
                      height={128}
                      className="object-cover"
                    />
                  ) : (
                    <ImageIcon className="h-12 w-12 text-muted-foreground" />
                  )}
                </div>
              </div>

              {/* Product Info */}
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium">{selectedProduct.name}</p>
                </div>

                {selectedProduct.description && (
                  <div>
                    <p className="text-sm text-muted-foreground">Beschreibung</p>
                    <p>{selectedProduct.description}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Preis</p>
                    <p className="font-medium">{formatCurrency(selectedProduct.price_cents)}</p>
                  </div>
                  {selectedProduct.compare_at_price_cents && (
                    <div>
                      <p className="text-sm text-muted-foreground">Streichpreis</p>
                      <p className="line-through text-muted-foreground">
                        {formatCurrency(selectedProduct.compare_at_price_cents)}
                      </p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Artikelnummer</p>
                    <p>{selectedProduct.sku || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Lagerbestand</p>
                    <p>{selectedProduct.stock_quantity}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Kategorie</p>
                    <p>{selectedProduct.category || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <Badge variant={selectedProduct.is_active ? 'default' : 'outline'}>
                      {selectedProduct.is_active ? 'Aktiv' : 'Inaktiv'}
                    </Badge>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
                  Schliessen
                </Button>
                <Button onClick={() => {
                  setViewDialogOpen(false);
                  handleEditProduct(selectedProduct);
                }}>
                  <Edit className="h-4 w-4 mr-2" />
                  Bearbeiten
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Product Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => {
        setEditDialogOpen(open);
        if (!open) {
          setEditingProduct(null);
          resetProductForm();
        }
      }}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Produkt bearbeiten</DialogTitle>
            <DialogDescription>
              Aktualisieren Sie die Produktinformationen.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdateProduct}>
            <div className="space-y-4 py-4">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="edit-name">Produktname *</Label>
                <Input
                  id="edit-name"
                  value={productForm.name}
                  onChange={(e) =>
                    setProductForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="z.B. Shampoo Professional"
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="edit-description">Beschreibung</Label>
                <Textarea
                  id="edit-description"
                  value={productForm.description}
                  onChange={(e) =>
                    setProductForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Produktbeschreibung..."
                  rows={3}
                />
              </div>

              {/* Price and Compare At Price */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-price">Preis (CHF) *</Label>
                  <Input
                    id="edit-price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={productForm.price}
                    onChange={(e) =>
                      setProductForm((prev) => ({ ...prev, price: e.target.value }))
                    }
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-compareAtPrice">Streichpreis (CHF)</Label>
                  <Input
                    id="edit-compareAtPrice"
                    type="number"
                    step="0.01"
                    min="0"
                    value={productForm.compareAtPrice}
                    onChange={(e) =>
                      setProductForm((prev) => ({
                        ...prev,
                        compareAtPrice: e.target.value,
                      }))
                    }
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* SKU and Stock */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-sku">Artikelnummer (SKU)</Label>
                  <Input
                    id="edit-sku"
                    value={productForm.sku}
                    onChange={(e) =>
                      setProductForm((prev) => ({ ...prev, sku: e.target.value }))
                    }
                    placeholder="z.B. SHP-001"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-stockQuantity">Lagerbestand</Label>
                  <Input
                    id="edit-stockQuantity"
                    type="number"
                    min="0"
                    value={productForm.stockQuantity}
                    onChange={(e) =>
                      setProductForm((prev) => ({
                        ...prev,
                        stockQuantity: e.target.value,
                      }))
                    }
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Active Switch */}
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label>Produkt aktiv</Label>
                  <p className="text-sm text-muted-foreground">
                    Aktive Produkte sind im Shop sichtbar
                  </p>
                </div>
                <Switch
                  checked={productForm.isActive}
                  onCheckedChange={(checked) =>
                    setProductForm((prev) => ({ ...prev, isActive: checked }))
                  }
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditDialogOpen(false);
                  setEditingProduct(null);
                  resetProductForm();
                }}
              >
                Abbrechen
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Speichere...
                  </>
                ) : (
                  'Speichern'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Product Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Neues Produkt erstellen</DialogTitle>
            <DialogDescription>
              Fügen Sie ein neues Produkt zu Ihrem Sortiment hinzu.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateProduct}>
            <div className="space-y-4 py-4">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name">Produktname *</Label>
                <Input
                  id="name"
                  value={productForm.name}
                  onChange={(e) =>
                    setProductForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="z.B. Shampoo Professional"
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Beschreibung</Label>
                <Textarea
                  id="description"
                  value={productForm.description}
                  onChange={(e) =>
                    setProductForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Produktbeschreibung..."
                  rows={3}
                />
              </div>

              {/* Price and Compare At Price */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Preis (CHF) *</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={productForm.price}
                    onChange={(e) =>
                      setProductForm((prev) => ({ ...prev, price: e.target.value }))
                    }
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="compareAtPrice">Streichpreis (CHF)</Label>
                  <Input
                    id="compareAtPrice"
                    type="number"
                    step="0.01"
                    min="0"
                    value={productForm.compareAtPrice}
                    onChange={(e) =>
                      setProductForm((prev) => ({
                        ...prev,
                        compareAtPrice: e.target.value,
                      }))
                    }
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* SKU and Stock */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sku">Artikelnummer (SKU)</Label>
                  <Input
                    id="sku"
                    value={productForm.sku}
                    onChange={(e) =>
                      setProductForm((prev) => ({ ...prev, sku: e.target.value }))
                    }
                    placeholder="z.B. SHP-001"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stockQuantity">Lagerbestand</Label>
                  <Input
                    id="stockQuantity"
                    type="number"
                    min="0"
                    value={productForm.stockQuantity}
                    onChange={(e) =>
                      setProductForm((prev) => ({
                        ...prev,
                        stockQuantity: e.target.value,
                      }))
                    }
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Active Switch */}
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label>Produkt aktiv</Label>
                  <p className="text-sm text-muted-foreground">
                    Aktive Produkte sind im Shop sichtbar
                  </p>
                </div>
                <Switch
                  checked={productForm.isActive}
                  onCheckedChange={(checked) =>
                    setProductForm((prev) => ({ ...prev, isActive: checked }))
                  }
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCreateDialogOpen(false);
                  resetProductForm();
                }}
              >
                Abbrechen
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Erstelle...
                  </>
                ) : (
                  'Produkt erstellen'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
