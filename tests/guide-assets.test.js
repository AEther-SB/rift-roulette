import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeRunes, normalizeItems, normalizeRunePage, runeIconUrl, itemIconUrl } from '../src/gameAssets.js';
import { blankPools } from '../src/data.js';
import { cleanAdvice, readyMembers } from '../src/roomLogic.js';

const trees = normalizeRunes([{
  id: 8100, name: 'Dominazione', icon: 'perk-images/Styles/Domination/7200_Domination.png',
  slots: [
    {runes:[{id:8112, name:'Elettroshock', icon:'perk-images/Styles/Domination/Electrocute/Electrocute.png'}]},
    {runes:[{id:8126, name:'Colpo basso', icon:'perk-images/X.png'}]},
    {runes:[{id:8138, name:'Ricordi', icon:'perk-images/X.png'}]},
    {runes:[{id:8135, name:'Cacciatore', icon:'perk-images/X.png'}]},
  ],
},{id:8200,name:'Stregoneria',icon:'perk-images/Styles/Sorcery/7202_Sorcery.png',slots:[
  {runes:[{id:8214,name:'Cometa',icon:'perk-images/X.png'}]},
  {runes:[{id:8226,name:'Manaflow',icon:'perk-images/X.png'}]},
  {runes:[{id:8233,name:'Concentrazione',icon:'perk-images/X.png'}]},
  {runes:[{id:8236,name:'Bruciare',icon:'perk-images/X.png'}]},
]}]);

test('Catalogo rune dalla struttura Data Dragon senza generare build', () => {
  assert.equal(trees.length,2);
  assert.equal(trees[0].slots[0][0].name,'Elettroshock');
  assert.match(runeIconUrl(trees[0].slots[0][0].icon), /^https:\/\/ddragon\.leagueoflegends\.com\/cdn\/img\/perk-images\//);
  assert.equal(runeIconUrl('javascript:alert(1)'), '');
});

test('Catalogo oggetti solo per Summoner’s Rift con icone ufficiali', () => {
  const items=normalizeItems({data:{'1001':{name:'Stivali', maps:{11:true},gold:{purchasable:true,total:300},image:{full:'1001.png'}},'1002':{name:'Rimosso',maps:{11:false},gold:{purchasable:true},image:{full:'1002.png'}}}});
  assert.deepEqual(items.map((x)=>x.id),['1001']);
  assert.match(itemIconUrl('1001','16.22.1'), /16\.22\.1\/img\/item\/1001\.png$/);
  assert.equal(itemIconUrl('javascript:alert(1)','16.22.1'), '');
});

test('Le guide strutturate conservano scelta rune e ordine fino a 6 oggetti', () => {
  const pool={...blankPools(),MID:['Ahri']};
  const raw={MID:{Ahri:{runePage:{primaryStyle:8100,secondaryStyle:8200,primary:[8112,8126,8138,8135],secondary:[8226,8233]},itemIds:['1001','1002','1001','1003','1004','1005','1006','1007'],notes:'Build mia'}}};
  const result=cleanAdvice(raw,pool).MID.Ahri;
  assert.equal(result.runePage.primaryStyle,8100);
  assert.deepEqual(result.runePage.secondary,[8226,8233]);
  assert.deepEqual(result.itemIds,['1001','1002','1003','1004','1005','1006']);
  assert.equal(result.notes,'Build mia');
});

test('La validazione delle rune ignora pick estranei al ramo e conserva la riga',()=> {
 const runes=normalizeRunePage({primaryStyle:8100,secondaryStyle:8200,primary:[8112,8214,8138,8135],secondary:[8226,8233]},trees);
 assert.deepEqual(runes.primary,[8112,0,8138,8135]);
 assert.deepEqual(runes.secondary,[8226,8233]);
});

test('Stanza parte con qualsiasi quantità da due a cinque indipendentemente da expectedPlayers legacy',()=> {
 const base={name:'user',pools:Object.fromEntries(['TOP','JUNGLE','MID','ADC','SUPPORT'].map((role)=>[role,['Ahri']])),online:true,readyRound:1};
 for(const n of [2,3,4,5]) {
   const room={meta:{phase:'waiting',round:1,expectedPlayers:5},members:Object.fromEntries(Array.from({length:n},(_,i)=>['id'+i,base]))};
   assert.equal(readyMembers(room).length,n);
 }
});

test('Regole Firebase accettano runePage e itemIds, non richiedono expectedPlayers',()=>{
 const rules=JSON.parse(readFileSync(new URL('../database.rules.json',import.meta.url)));
 const meta=rules.rules.rooms.$room.meta;
 assert.ok(!meta['.validate'].includes("'expectedPlayers'"));
 const guide=rules.rules.rooms.$room.members.$uid.advice.$role.$champion;
 assert.ok(guide.runePage.primary['$index']);
 assert.ok(guide.itemIds['$index']);
});
