import importlib.util, json, tempfile, shutil, unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('build_tags', ROOT / 'scripts' / 'build_tags.py')
build_tags = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build_tags)

class BuildTagsR2Tests(unittest.TestCase):
    def setUp(self):
        self.td=Path(tempfile.mkdtemp()); (self.td/'works').mkdir(); (self.td/'tags.json').write_text('{"version":1,"works":{}}\n')
    def tearDown(self): shutil.rmtree(self.td, ignore_errors=True)
    def fake_run(self, cmd, **kw):
        m=mock.Mock(); m.returncode=0; m.stderr=''
        if cmd[:2]==['rclone','lsf']:
            m.stdout='a/details.json\nb/details.json\nc/details.json\nd/details.json\ne/details.json\n'
        else:
            name=cmd[-1]
            if '/a/' in name: m.stdout=json.dumps({'work':{'slug':'A','tags':['One']}})
            elif '/b/' in name: m.stdout='{'
            elif '/c/' in name: m.stdout=json.dumps({'work':{'tags':['missing']}})
            elif '/d/' in name: m.returncode=1; m.stdout=''; m.stderr='nope'
            else: m.stdout=json.dumps({'work':{'slug':'A','tags':['one']}})
        return m
    def test_from_r2_details_cases_and_bounded_workers(self):
        catalog={'version':1,'works':{}}
        with mock.patch.object(build_tags.subprocess,'run', side_effect=self.fake_run), \
             mock.patch.object(build_tags.concurrent.futures,'ThreadPoolExecutor', wraps=build_tags.concurrent.futures.ThreadPoolExecutor) as ex:
            counts=build_tags.merge_r2(catalog,'r:',0)
        self.assertEqual(counts, {'examined':5,'imported':1,'skipped':1,'malformed':2,'failed':1})
        self.assertEqual(catalog['works']['A']['tags'], ['one'])
        self.assertEqual(ex.call_args.kwargs['max_workers'], 1)
    def test_existing_canonical_tags_are_not_overwritten_by_mirrors(self):
        (self.td/'tags.json').write_text(json.dumps({'version':1,'works':{'A':{'tags':[],'sources':['manual'],'updated_at':None},'B':{'tags':['manual'],'sources':['manual'],'updated_at':None}}})+'\n')
        (self.td/'works'/'A.json').write_text(json.dumps({'slug':'A','tags':['stale']})+'\n')
        (self.td/'fetch.json').write_text(json.dumps({'works':[{'slug':'B','tags':['stale']},{'slug':'C','tags':['seed']}]})+'\n')
        catalog, counts = build_tags.catalog_from_local(self.td)
        self.assertEqual(catalog['works']['A']['tags'], [])
        self.assertEqual(catalog['works']['B']['tags'], ['manual'])
        self.assertEqual(catalog['works']['C']['tags'], ['seed'])
        self.assertEqual(counts['changed_entries'], 1)

    def test_r2_does_not_overwrite_existing_unless_opted_in(self):
        catalog={'version':1,'works':{'A':{'tags':[],'sources':['manual'],'updated_at':None}}}
        with mock.patch.object(build_tags.subprocess,'run', side_effect=self.fake_run):
            counts=build_tags.merge_r2(catalog,'r:',1)
        self.assertEqual(catalog['works']['A']['tags'], [])
        self.assertEqual(counts['imported'], 0)
        with mock.patch.object(build_tags.subprocess,'run', side_effect=self.fake_run):
            build_tags.merge_r2(catalog,'r:',1, overwrite_existing=True)
        self.assertEqual(catalog['works']['A']['tags'], ['one'])

    def test_dry_run_performs_no_write(self):
        (self.td/'rotunda.json').write_text(json.dumps({'version':1,'works':[{'slug':'Private','public':False}], 'public_rotunda': {'omit_works': []}})+'\n')
        before_rotunda=(self.td/'rotunda.json').read_text()
        before=(self.td/'tags.json').read_text()
        with mock.patch.object(build_tags,'repo_root', return_value=self.td), \
             mock.patch.object(build_tags.subprocess,'run', side_effect=self.fake_run):
            self.assertEqual(build_tags.main(['--data-dir','.','--from-r2-details','--dry-run']),0)
        self.assertEqual((self.td/'tags.json').read_text(), before)
        self.assertEqual((self.td/'rotunda.json').read_text(), before_rotunda)
    def test_legacy_public_false_migrates_to_exact_omit(self):
        (self.td/'rotunda.json').write_text(json.dumps({'version':1,'works':[{'slug':'Exact','public':False}], 'public_rotunda': {'omit_works': []}})+'\n')
        self.assertEqual(build_tags.migrate_legacy_public_false(self.td), 1)
        self.assertEqual(json.loads((self.td/'rotunda.json').read_text())['public_rotunda']['omit_works'], ['Exact'])

if __name__ == '__main__':
    unittest.main()
