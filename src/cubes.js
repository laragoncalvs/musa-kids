import * as THREE from 'three';

import aImg from '../assets/letras/a.png';
import bImg from '../assets/letras/b.png';
import cImg from '../assets/letras/c.png';
import dImg from '../assets/letras/d.png';
import eImg from '../assets/letras/e.png';
import fImg from '../assets/letras/f.png';
import gImg from '../assets/letras/g.png';
import hImg from '../assets/letras/h.png';
import iImg from '../assets/letras/i.png';
import jImg from '../assets/letras/j.png';
import kImg from '../assets/letras/k.png';
import lImg from '../assets/letras/l.png';
import mImg from '../assets/letras/m.png';
import nImg from '../assets/letras/n.png';
import oImg from '../assets/letras/o.png';
import pImg from '../assets/letras/p.png';
import qImg from '../assets/letras/q.png';
import rImg from '../assets/letras/r.png';
import sImg from '../assets/letras/s.png';
import tImg from '../assets/letras/t.png';
import uImg from '../assets/letras/u.png';
import vImg from '../assets/letras/v.png';
import wImg from '../assets/letras/w.png';
import xImg from '../assets/letras/x.png';
import yImg from '../assets/letras/y.png';
import zImg from '../assets/letras/z.png';
import çImg from '../assets/letras/ç.png';
import zeroImg from '../assets/letras/0.png';
import umImg from '../assets/letras/1.png';
import doisImg from '../assets/letras/2.png';
import tresImg from '../assets/letras/3.png';
import quatroImg from '../assets/letras/4.png';
import cincoImg from '../assets/letras/5.png';
import seisImg from '../assets/letras/6.png';
import seteImg from '../assets/letras/7.png';
import oitoImg from '../assets/letras/8.png';
import noveImg from '../assets/letras/9.png';
import agudoImg from '../assets/letras/agudo.png';
import aspaImg from '../assets/letras/aspa.png';
import chaveDirImg from '../assets/letras/chave dir.png';
import chaveEsqImg from '../assets/letras/chave esq.png';
import hifenImg from '../assets/letras/hifen.png';
import igualImg from '../assets/letras/igual.png';
import pontoVirgulaImg from '../assets/letras/pontoVirgula.png';
import tilImg from '../assets/letras/til.png';
import virgulaImg from '../assets/letras/virgula.png';


import aImg2 from '../assets/letras2/a.png';
import bImg2 from '../assets/letras2/b.png';
import cImg2 from '../assets/letras2/c.png';
import dImg2 from '../assets/letras2/d.png';
import eImg2 from '../assets/letras2/e.png';
import fImg2 from '../assets/letras2/f.png';
import gImg2 from '../assets/letras2/g.png';
import hImg2 from '../assets/letras2/h.png';
import iImg2 from '../assets/letras2/i.png';
import jImg2 from '../assets/letras2/j.png';
import kImg2 from '../assets/letras2/k.png';
import lImg2 from '../assets/letras2/l.png';
import mImg2 from '../assets/letras2/m.png';
import nImg2 from '../assets/letras2/n.png';
import oImg2 from '../assets/letras2/o.png';
import pImg2 from '../assets/letras2/p.png';
import qImg2 from '../assets/letras2/q.png';
import rImg2 from '../assets/letras2/r.png';
import sImg2 from '../assets/letras2/s.png';
import tImg2 from '../assets/letras2/t.png';
import uImg2 from '../assets/letras2/u.png';
import vImg2 from '../assets/letras2/v.png';
import wImg2 from '../assets/letras2/w.png';
import xImg2 from '../assets/letras2/x.png';
import yImg2 from '../assets/letras2/y.png';
import zImg2 from '../assets/letras2/z.png';
import çImg2 from '../assets/letras2/ç.png';
import zeroImg2 from '../assets/letras2/0.png';
import umImg2 from '../assets/letras2/1.png';
import doisImg2 from '../assets/letras2/2.png';
import tresImg2 from '../assets/letras2/3.png';
import quatroImg2 from '../assets/letras2/4.png';
import cincoImg2 from '../assets/letras2/5.png';
import seisImg2 from '../assets/letras2/6.png';
import seteImg2 from '../assets/letras2/7.png';
import oitoImg2 from '../assets/letras2/8.png';
import noveImg2 from '../assets/letras2/9.png';
import agudoImg2 from '../assets/letras2/agudo.png';
import aspaImg2 from '../assets/letras2/aspa.png';
import chaveDirImg2 from '../assets/letras2/chave dir.png';
import chaveEsqImg2 from '../assets/letras2/chave esq.png';
import hifenImg2 from '../assets/letras2/hifen.png';
import igualImg2 from '../assets/letras2/igual.png';
import pontoVirgulaImg2 from '../assets/letras2/pontoVirgula.png';
import tilImg2 from '../assets/letras2/til.png';
import virgulaImg2 from '../assets/letras2/virgula.png';




const textureLoader = new THREE.TextureLoader();
const baseColor = 0x5C2569;

const letterTextures = {
    a: aImg, b: bImg, c: cImg, d: dImg, e: eImg, f: fImg, g: gImg, h: hImg, i: iImg,
    j: jImg, k: kImg, l: lImg, m: mImg, n: nImg, o: oImg, p: pImg, q: qImg, r: rImg,
    s: sImg, t: tImg, u: uImg, v: vImg, w: wImg, x: xImg, y: yImg, z: zImg, ç: çImg,
    "0": zeroImg, "1": umImg, "2": doisImg, "3": tresImg, "4": quatroImg,
    "5": cincoImg, "6": seisImg, "7": seteImg, "8": oitoImg, "9": noveImg,
    agudo: agudoImg, aspa: aspaImg, chave_direita: chaveDirImg, chave_esquerda: chaveEsqImg,
    hifen: hifenImg, igual: igualImg, ponto_virgula: pontoVirgulaImg,
    til: tilImg, virgula: virgulaImg
};

const letterTexturesAlt = {
    a: aImg2, b: bImg2, c: cImg2, d: dImg2, e: eImg2, f: fImg2, g: gImg2, h: hImg2, i: iImg2,
    j: jImg2, k: kImg2, l: lImg2, m: mImg2, n: nImg2, o: oImg2, p: pImg2, q: qImg2, r: rImg2,
    s: sImg2, t: tImg2, u: uImg2, v: vImg2, w: wImg2, x: xImg2, y: yImg2, z: zImg2, ç: çImg2,
    "0": zeroImg2, "1": umImg2, "2": doisImg2, "3": tresImg2, "4": quatroImg2,
    "5": cincoImg2, "6": seisImg2, "7": seteImg2, "8": oitoImg2, "9": noveImg2,
    agudo: agudoImg2, aspa: aspaImg2, chave_direita: chaveDirImg2, chave_esquerda: chaveEsqImg2,
    hifen: hifenImg2, igual: igualImg2, ponto_virgula: pontoVirgulaImg2,
    til: tilImg2, virgula: virgulaImg2
};

const loadedTextures = {};
const loadedTexturesAlt = {};

for (const [letra, imgPath] of Object.entries(letterTextures)) {
    const texture = textureLoader.load(imgPath);
    texture.colorSpace = THREE.SRGBColorSpace;
    loadedTextures[letra] = texture;
}

for (const [letra, imgPath] of Object.entries(letterTexturesAlt)) {
    const texture = textureLoader.load(imgPath);
    texture.colorSpace = THREE.SRGBColorSpace;
    loadedTexturesAlt[letra] = texture;
}

const createCube = (key) => {
    const texture = loadedTextures[key];
    const materials = [];

    for (let i = 0; i < 6; i++) {
        if (i === 2) {
            materials.push(new THREE.MeshBasicMaterial({ map: texture, transparent: true }));
        } else {
            materials.push(new THREE.MeshStandardMaterial({
                color: baseColor,
                transparent: true,
                opacity: 1
            }));
        }
    }

    const cube = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 0.8), materials);
    return cube;
};


const allCubes = {};
Object.keys(letterTextures).forEach((key) => {
    allCubes[key] = createCube(key);
});

const linhas = [-6, -4.9, -3.8, -2.7, -1.6, -0.55, 0.55, 1.6, 2.7, 3.8, 4.9, 6];
const initz = -11;
const inity = 0.4;

const posicoes = [
    ["a", "q", "z", "1", "aspa"], ["s", "w", "x", "2"], ["c", "d", "e", "3"], ["r", "f", "v", "4"], ["g", "t", "b", "5"],
    ["h", "y", "n", "6"], ["u", "j", "m", "7"], ["k", "i", "8"], ["o", "l", "9", "virgula"], ["p", "ç", "0"], ["hifen", "agudo", "til", "ponto_virgula"],
    ["igual", "chave_esquerda", "chave_direita"]
];

posicoes.forEach((grupo, index) => {
    grupo.forEach(letra => {
        if (allCubes[letra]) {
            allCubes[letra].position.x = linhas[index];
        }
    });
});
Object.values(allCubes).forEach((cube) => {
    cube.position.y = inity;
    cube.position.z = initz;
});

export { allCubes, loadedTexturesAlt };
