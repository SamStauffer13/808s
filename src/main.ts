import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'
import { loadTheme } from './lib/theme.svelte'

loadTheme() // before the first paint, so a saved color never flashes green

mount(App, { target: document.getElementById('app')! })
