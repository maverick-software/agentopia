import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AnalyticsTab } from './components/AnalyticsTab';
import { CategoriesTab } from './components/CategoriesTab';
import { LibraryFilters } from './components/LibraryFilters';
import { MediaFilesView } from './components/MediaFilesView';
import { MediaLibraryHeader } from './components/MediaLibraryHeader';
import { MediaStatsCards } from './components/MediaStatsCards';
import { UploadDialog } from './components/UploadDialog';
import { useMediaLibrary } from './hooks/useMediaLibrary';

export function MediaLibraryPage() {
  const {
    categories,
    stats,
    loading,
    uploading,
    viewMode,
    searchQuery,
    selectedCategory,
    selectedStatus,
    sortBy,
    sortOrder,
    isDragOver,
    showUploadModal,
    filteredFiles,
    setViewMode,
    setSearchQuery,
    setSelectedCategory,
    setSelectedStatus,
    setSortBy,
    setSortOrder,
    setShowUploadModal,
    handleFileUpload,
    handleViewDocument,
    handleDownloadDocument,
    handleDeleteDocument,
    handleDrop,
    handleDragOver,
    handleDragLeave,
  } = useMediaLibrary();

  const hasActiveFilters = searchQuery !== '' || selectedCategory !== 'all' || selectedStatus !== 'all';

  return (
    <div className="container mx-auto p-6 space-y-6">
      <MediaLibraryHeader
        uploading={uploading}
        viewMode={viewMode}
        onUploadClick={() => setShowUploadModal(true)}
        onToggleViewMode={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
      />

      <MediaStatsCards stats={stats} />

      <Tabs defaultValue="library" className="space-y-4">
        <TabsList>
          <TabsTrigger value="library">Library</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="library" className="space-y-4">
          <LibraryFilters
            categories={categories}
            searchQuery={searchQuery}
            selectedCategory={selectedCategory}
            selectedStatus={selectedStatus}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSearchQueryChange={setSearchQuery}
            onSelectedCategoryChange={setSelectedCategory}
            onSelectedStatusChange={setSelectedStatus}
            onSortChange={(field, order) => {
              setSortBy(field);
              setSortOrder(order);
            }}
          />

          <MediaFilesView
            loading={loading}
            filteredFiles={filteredFiles}
            viewMode={viewMode}
            hasActiveFilters={hasActiveFilters}
            onView={handleViewDocument}
            onDownload={handleDownloadDocument}
            onDelete={handleDeleteDocument}
          />
        </TabsContent>

        <TabsContent value="categories">
          <CategoriesTab categories={categories} />
        </TabsContent>

        <TabsContent value="analytics">
          <AnalyticsTab stats={stats} />
        </TabsContent>
      </Tabs>

      <UploadDialog
        open={showUploadModal}
        uploading={uploading}
        isDragOver={isDragOver}
        onOpenChange={setShowUploadModal}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onFileUpload={handleFileUpload}
      />
    </div>
  );
}
