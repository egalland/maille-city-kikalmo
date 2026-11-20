import test from 'node:test';
import assert from 'node:assert/strict';
import {createArmorLayer,outfitShop} from '../public/outfit-shop.js';
import {puppetAppearance} from '../public/puppet-dyes.js';

test('the outfit preserves character fur and recolors the actual jacket yarn',()=>{
  const original=puppetAppearance('fox','foret',12),dyed=puppetAppearance('fox','foret~indigo',12);
  assert.deepEqual(dyed.pelt,original.pelt);assert.notEqual(dyed.coat,original.coat);assert.equal(dyed.coat,outfitShop.dyes.indigo.color);
});

test('a purchased vest absorbs gunshots, officer fire and punches before health; predicted wear survives reload',()=>{
  const memory=new Map(),storage={setItem:(k,v)=>memory.set(k,v),getItem:k=>memory.get(k),removeItem:k=>memory.delete(k)};
  const grant={armorId:'grant1',armor:40,wearable:true},layer=createArmorLayer(storage);
  layer.apply(grant);assert.equal(layer.absorb(5,'fall'),0);assert.equal(layer.absorb(5,'police'),5);
  assert.equal(layer.absorb(19,'weapon'),19);assert.equal(layer.armor,16);
  const reload=createArmorLayer(storage);reload.apply(grant);assert.deepEqual(reload.wear(),{id:'grant1',remaining:16});
  assert.equal(reload.absorb(25,'melee'),16);assert.equal(reload.armor,0);
  reload.apply({...grant,armor:20});assert.equal(reload.armor,0);
  reload.apply({...grant,armorId:'replacement'});assert.equal(reload.armor,40);
});
