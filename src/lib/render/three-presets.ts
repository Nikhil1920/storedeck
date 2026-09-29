// 3D device color presets (kept separate from three.ts so tools and UI can
// list them without loading three.js).

import type { Model3D } from '../model/types'

export interface ModelColorPreset {
  id: string
  label: string
  swatch: string
  materials: Record<string, string>
}

export const MODEL_COLOR_PRESETS: Record<Model3D, ModelColorPreset[]> = {
  iphone: [
    { id: 'natural', label: 'Natural Titanium', swatch: '#9d927f', materials: { backpanel: '#9d927f', metalframe: '#5f5950', gray: '#221f1b' } },
    { id: 'blue', label: 'Blue Titanium', swatch: '#3d4d5c', materials: { backpanel: '#394d5f', metalframe: '#3a4553', gray: '#1a1f24' } },
    { id: 'white', label: 'White Titanium', swatch: '#e3ddd4', materials: { backpanel: '#e3ddd4', metalframe: '#c4bdb4', gray: '#2a2825' } },
    { id: 'black', label: 'Black Titanium', swatch: '#3a3632', materials: { backpanel: '#3a3632', metalframe: '#2a2725', gray: '#1a1918' } },
    { id: 'desert', label: 'Desert Titanium', swatch: '#c4a882', materials: { backpanel: '#c4a882', metalframe: '#8a7560', gray: '#2a2218' } },
    { id: 'deep-purple', label: 'Deep Purple', swatch: '#5b4a6e', materials: { backpanel: '#5b4a6e', metalframe: '#3d3348', gray: '#1e1825' } },
    { id: 'gold', label: 'Gold', swatch: '#e3c8a0', materials: { backpanel: '#e3c8a0', metalframe: '#c9a96e', gray: '#2a2418' } },
    { id: 'red', label: 'Product Red', swatch: '#c1272d', materials: { backpanel: '#c1272d', metalframe: '#8a1c20', gray: '#1a0a0a' } },
  ],
  samsung: [
    { id: 'gray', label: 'Titanium Gray', swatch: '#8a8a8a', materials: { back_glass: '#4c4c4c', frame: '#cdcdcd', antenna: '#707070' } },
    { id: 'black', label: 'Titanium Black', swatch: '#2a2a2a', materials: { back_glass: '#1a1a1a', frame: '#3a3a3a', antenna: '#2a2a2a' } },
    { id: 'silverblue', label: 'Titanium Silverblue', swatch: '#a8b8c8', materials: { back_glass: '#8a9eb0', frame: '#b8c8d4', antenna: '#7a8ea0' } },
    { id: 'whitesilver', label: 'Titanium Whitesilver', swatch: '#e8e4df', materials: { back_glass: '#d8d4cf', frame: '#e8e4df', antenna: '#c0bcb7' } },
    { id: 'pinkgold', label: 'Titanium Pinkgold', swatch: '#d4a89a', materials: { back_glass: '#c89888', frame: '#d4b0a0', antenna: '#b08878' } },
    { id: 'jadegreen', label: 'Titanium Jadegreen', swatch: '#9aaa9c', materials: { back_glass: '#7a9a7c', frame: '#a8b8aa', antenna: '#6a8a6c' } },
    { id: 'jetblack', label: 'Titanium Jetblack', swatch: '#404040', materials: { back_glass: '#2a2a2a', frame: '#484848', antenna: '#353535' } },
  ],
}
