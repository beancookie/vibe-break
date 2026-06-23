import { mount } from "svelte";
import VrmViewer from "./components/VrmViewer.svelte";

const target = document.getElementById("app");
if (!target) throw new Error("Missing #app root element");

const app = mount(VrmViewer, { target });

export default app;
