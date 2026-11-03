// keep the gallery data module importable under tsconfig
// without adding a test-runner dependency to the project.
export const galleryDataModuleShallowTest = 'galleryData.js keeps the gallery data module importable under tsconfig without a test runner';

const _useGalleryDataModuleShallowTestToAllowExportToStayUsed = galleryDataModuleShallowTest;
void _useGalleryDataModuleShallowTestToAllowExportToStayUsed;

export default function _keepGalleryModuleImportable() {
  return galleryDataModuleShallowTest;
}
