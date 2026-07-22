import argparse
import json
import importlib.util
import shutil
import stat
import tempfile
import unittest
import zipfile
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('ingest_work', ROOT / 'scripts' / 'ingest-work.py')
ingest = importlib.util.module_from_spec(spec)
sys.modules['ingest_work'] = ingest
spec.loader.exec_module(ingest)


def args(**kw):
    d = dict(dry_run=False, extract_dir=None, overwrite_extracted=False, keep_extracted=False,
             cleanup_extracted=False, merge_root_images_into_chapter_one=False, no_auto_chapter=False)
    d.update(kw)
    return argparse.Namespace(**d)


def img(p: Path):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_bytes(b'x')


class PreprocessTests(unittest.TestCase):
    def setUp(self):
        self.td = Path(tempfile.mkdtemp())
    def tearDown(self):
        shutil.rmtree(self.td, ignore_errors=True)
    def zipit(self, name, files):
        z = self.td / name
        with zipfile.ZipFile(z, 'w') as f:
            for arc, data in files.items():
                f.writestr(arc, data)
        return z

    def test_organized_folder_remains(self):
        root=self.td/'Work'; img(root/'chapter_1'/'001.jpg')
        out,_,_=ingest.prepare_work_root(root,args())
        self.assertEqual(out, root); self.assertTrue((root/'chapter_1'/'001.jpg').exists())

    def test_loose_images_create_chapter(self):
        root=self.td/'Work'; img(root/'p2.jpg'); img(root/'p1.jpg')
        out,_,_=ingest.prepare_work_root(root,args())
        self.assertEqual(out, root); self.assertTrue((root/'chapter_1'/'p1.jpg').exists())

    def test_natural_sort_before_renumber(self):
        root=self.td/'Work'; [img(root/f'p{i}.jpg') for i in [10,2,1]]
        ingest.prepare_work_root(root,args()); ch=ingest.detect_chapters(root)
        self.assertEqual([p.name for p in ch[0].images], ['p1.jpg','p2.jpg','p10.jpg'])
        ingest.renumber_pages(ch, False); self.assertTrue((root/'chapter_1'/'001.jpg').exists())

    def test_zip_loose_images(self):
        z=self.zipit('Zip Work.zip', {'b.jpg':b'x','a.jpg':b'x'})
        out,ex,temp=ingest.prepare_work_root(z,args())
        self.assertTrue((out/'chapter_1'/'a.jpg').exists()); self.assertTrue(z.exists())

    def test_zip_chapter_folders(self):
        z=self.zipit('Work.zip', {'chapter_1/1.jpg':b'x'})
        out,_,_=ingest.prepare_work_root(z,args())
        self.assertTrue((out/'chapter_1'/'1.jpg').exists())

    def test_zip_one_wrapper(self):
        z=self.zipit('Work.zip', {'wrap/chapter_1/1.jpg':b'x'})
        out,_,_=ingest.prepare_work_root(z,args())
        self.assertEqual(out.name, 'wrap')

    def test_zip_multiple_wrappers(self):
        z=self.zipit('Work.zip', {'a/b/chapter_1/1.jpg':b'x'})
        out,_,_=ingest.prepare_work_root(z,args())
        self.assertEqual(out.name, 'b')

    def test_zip_junk_ignored(self):
        z=self.zipit('Work.zip', {'__MACOSX/x':b'x','.DS_Store':b'x','wrap/chapter_1/1.jpg':b'x'})
        out,_,_=ingest.prepare_work_root(z,args())
        self.assertEqual(out.name, 'wrap')

    def test_zip_traversal_rejected(self):
        z=self.zipit('bad.zip', {'../evil.jpg':b'x'})
        with self.assertRaises(SystemExit): ingest.prepare_work_root(z,args())

    def test_zip_absolute_rejected(self):
        z=self.zipit('bad.zip', {'/evil.jpg':b'x'})
        with self.assertRaises(SystemExit): ingest.prepare_work_root(z,args())

    def test_zip_symlink_rejected(self):
        z=self.td/'bad.zip'; zi=zipfile.ZipInfo('link'); zi.external_attr=(stat.S_IFLNK | 0o777) << 16
        with zipfile.ZipFile(z,'w') as f: f.writestr(zi, 'target')
        with self.assertRaises(SystemExit): ingest.prepare_work_root(z,args())

    def test_batch_folders_and_zips(self):
        parent=self.td/'batch'; img(parent/'A'/'chapter_1'/'1.jpg'); self.zipit('B.zip', {'1.jpg':b'x'}).rename(parent/'B.zip')
        got=[p.name for p in ingest.discover_batch_inputs(parent)]
        self.assertEqual(got, ['A','B.zip'])

    def test_mixed_fails(self):
        root=self.td/'Work'; img(root/'chapter_1'/'1.jpg'); img(root/'loose.jpg')
        with self.assertRaises(SystemExit): ingest.prepare_work_root(root,args())

    def test_existing_chapter_not_nested(self):
        root=self.td/'Work'; img(root/'chapter_1'/'p.jpg')
        ingest.prepare_work_root(root,args())
        self.assertFalse((root/'chapter_1'/'chapter_1').exists())

    def test_parent_id_reuse_and_determinism(self):
        data=self.td/'data'; (data/'works').mkdir(parents=True); (data/'works'/'Slug.json').write_text('{"parent_work_id": 42}')
        self.assertEqual(ingest.existing_parent_work_id(data,'Slug'),42)
        self.assertEqual(ingest.deterministic_parent_work_id('Slug'), ingest.deterministic_parent_work_id('Slug'))
        self.assertNotEqual(ingest.deterministic_parent_work_id('Slug'), ingest.deterministic_parent_work_id('slug'))

    def test_repo_paths_same(self):
        self.assertEqual(ingest.resolve_repo_path('src/data'), ROOT/'src/data')

    def test_dry_run_no_mutation_and_thumb_excluded(self):
        root=self.td/'Work'; img(root/'2.jpg'); img(root/'thumb.webp')
        ingest.prepare_work_root(root,args(dry_run=True))
        self.assertTrue((root/'2.jpg').exists()); self.assertFalse((root/'chapter_1').exists())
        self.assertEqual(len(ingest.root_page_images(root)),1)

    def test_failed_extraction_cleanup_and_overwrite(self):
        z=self.zipit('bad.zip', {'../evil.jpg':b'x'}); dest=self.td/'dest'
        with self.assertRaises(SystemExit): ingest.prepare_work_root(z,args(extract_dir=str(dest)))
        good=self.zipit('good.zip', {'1.jpg':b'x'}); dest.mkdir(exist_ok=True); (dest/'x').write_text('x')
        with self.assertRaises(SystemExit): ingest.prepare_work_root(good,args(extract_dir=str(dest)))
        ingest.prepare_work_root(good,args(extract_dir=str(dest), overwrite_extracted=True))
        self.assertTrue(good.exists())

class TagCatalogTests(unittest.TestCase):
    def setUp(self):
        self.td = Path(tempfile.mkdtemp())
        (self.td/'works').mkdir()
    def tearDown(self):
        shutil.rmtree(self.td, ignore_errors=True)
    def test_ingestion_creates_preserves_clears_and_merges_tags(self):
        p = ingest.update_tags_catalog(self.td, 'Slug', [' Romance ', 'romance'], False, 'ingest')
        self.assertTrue(p.exists())
        data = json.loads(p.read_text())
        self.assertEqual(data['works']['Slug']['tags'], ['romance'])
        ns = args(tags='', clear_tags=False, private=False, public=False)
        self.assertIsNone(ingest.parse_tags_arg(ns.tags))
        self.assertEqual(ingest.apply_metadata_options({'tags':['romance']}, ns)['tags'], ['romance'])
        ns = args(tags=None, clear_tags=True, private=False, public=False)
        self.assertEqual(ingest.apply_metadata_options({'tags':['romance']}, ns)['tags'], [])
        self.assertEqual(ingest.merge_tags(['romance'], ['Linux Tag', 'romance']), ['romance', 'linux-tag'])

    def test_canonical_precedence_and_atomic_failure(self):
        (self.td/'tags.json').write_text(json.dumps({'version':1,'works':{'Slug':{'tags':['manual-tag'],'sources':['manual'],'updated_at':None}}})+'\n')
        self.assertEqual(ingest.resolve_canonical_tags(self.td,'Slug',[]), ['manual-tag'])
        ingest.update_tags_catalog(self.td,'Slug',ingest.resolve_canonical_tags(self.td,'Slug',[]),False,'ingest')
        manifest={'slug':'Slug','tags':ingest.resolve_canonical_tags(self.td,'Slug',[])}
        self.assertEqual(manifest['tags'], ['manual-tag'])
        details={'work': {'slug':'Slug','tags': manifest['tags']}}
        self.assertEqual(details['work']['tags'], ['manual-tag'])
        self.assertEqual(ingest.resolve_canonical_tags(self.td,'Slug',[], explicit_tags=['new-tag']), ['new-tag'])
        ingest.update_tags_catalog(self.td,'Slug',['new-tag'],False,'ingest')
        self.assertEqual(ingest.resolve_canonical_tags(self.td,'Slug',[], linux_tags=['Linux Tag']), ['new-tag','linux-tag'])
        ingest.update_tags_catalog(self.td,'Slug',[],False,'ingest')
        self.assertEqual(ingest.resolve_canonical_tags(self.td,'Slug',['stale-manifest'], linux_tags=['Linux Tag']), ['linux-tag'])
        self.assertEqual(ingest.resolve_canonical_tags(self.td,'Slug',['new-tag'], clear_tags=True), [])
        before=(self.td/'tags.json').read_text()
        orig=ingest.os.replace
        def fail(src,dst):
            raise OSError('boom')
        ingest.os.replace=fail
        try:
            with self.assertRaises(OSError): ingest.update_tags_catalog(self.td,'Slug',['broken'],False,'ingest')
        finally:
            ingest.os.replace=orig
        self.assertEqual((self.td/'tags.json').read_text(), before)
        self.assertFalse(list(self.td.glob('.tags.json.*.tmp')))

    def test_rotunda_privacy_sync_exact_idempotent_and_preserves_policy(self):
        (self.td/'rotunda.json').write_text(json.dumps({'version':1,'public_rotunda':{'omit_works':['Other'],'showcase_tags':['keep']},'works':[{'slug':'Other','tags':['x']}], 'extra': {'keep': True}})+'\n')
        ns=args(private=True, public=False, dry_run=False)
        ingest.sync_rotunda_privacy(self.td, 'Exact', ns)
        ingest.sync_rotunda_privacy(self.td, 'Exact', ns)
        data=json.loads((self.td/'rotunda.json').read_text())
        self.assertEqual(data['public_rotunda']['omit_works'], ['Exact','Other'])
        self.assertEqual(data['public_rotunda']['showcase_tags'], ['keep'])
        self.assertEqual(data['works'], [{'slug':'Other','tags':['x']}])
        ns.private=False; ns.public=True
        ingest.sync_rotunda_privacy(self.td, 'Exact', ns)
        ingest.sync_rotunda_privacy(self.td, 'Exact', ns)
        self.assertEqual(json.loads((self.td/'rotunda.json').read_text())['public_rotunda']['omit_works'], ['Other'])

    def test_rotunda_atomic_failure_preserves_json(self):
        (self.td/'rotunda.json').write_text(json.dumps({'version':1,'public_rotunda':{'omit_works':['Safe']},'works':[]})+'\n')
        before=(self.td/'rotunda.json').read_text()
        orig=ingest.os.replace
        ingest.os.replace=lambda src,dst: (_ for _ in ()).throw(OSError('boom'))
        try:
            with self.assertRaises(OSError): ingest.sync_rotunda_privacy(self.td, 'Exact', args(private=True, public=False, dry_run=False))
        finally:
            ingest.os.replace=orig
        self.assertEqual((self.td/'rotunda.json').read_text(), before)

    def test_metadata_only_uses_catalog_precedence(self):
        (self.td/'tags.json').write_text(json.dumps({'version':1,'works':{'Slug':{'tags':['manual-tag'],'sources':['manual'],'updated_at':None}}})+'\n')
        (self.td/'works'/'Slug.json').write_text(json.dumps({'slug':'Slug'})+'\n')
        (self.td/'rotunda.json').write_text(json.dumps({'version':1,'public_rotunda':{'omit_works':[]},'works':[{'slug':'Slug'}]})+'\n')
        ns=args(slug='Slug', repo_data=str(self.td), tags=None, clear_tags=False, private=True, public=False, update_rotunda=False, dry_run=False)
        ingest.metadata_only_update(ns)
        self.assertEqual(json.loads((self.td/'works'/'Slug.json').read_text())['tags'], ['manual-tag'])
        self.assertEqual(json.loads((self.td/'rotunda.json').read_text())['public_rotunda']['omit_works'], ['Slug'])
        ns.private=False; ns.public=True
        ingest.metadata_only_update(ns)
        self.assertEqual(json.loads((self.td/'rotunda.json').read_text())['public_rotunda']['omit_works'], [])
        ns.public=False; ns.tags='new-tag'
        ingest.metadata_only_update(ns)
        self.assertEqual(json.loads((self.td/'tags.json').read_text())['works']['Slug']['tags'], ['new-tag'])
        ns.tags=None; ns.clear_tags=True
        ingest.metadata_only_update(ns)
        self.assertEqual(json.loads((self.td/'tags.json').read_text())['works']['Slug']['tags'], [])

    def test_cbz_supported_like_zip(self):
        z = self.td/'Work.cbz'
        with zipfile.ZipFile(z,'w') as f: f.writestr('1.jpg', b'x')
        out,_,_=ingest.prepare_work_root(z,args())
        self.assertTrue((out/'chapter_1'/'1.jpg').exists())

if __name__ == '__main__':
    unittest.main()
