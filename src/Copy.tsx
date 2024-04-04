import { useEffect, useState } from "react";
import { invoke } from '@tauri-apps/api/tauri';
import { register, unregister } from '@tauri-apps/api/globalShortcut';
import { PhysicalPosition, appWindow } from "@tauri-apps/api/window";
import { readText } from '@tauri-apps/api/clipboard';
import { Input } from "./components/ui/input";
import { ScrollArea } from "./components/ui/scroll-area_copy";
import CodeEditor from '@uiw/react-textarea-code-editor';
import { Button } from "./components/ui/button";
import './styles.css'
import { writeTextFile, BaseDirectory, readTextFile } from '@tauri-apps/api/fs';
import { emit, listen } from '@tauri-apps/api/event'
import { requestPermission, sendNotification } from '@tauri-apps/api/notification';

appWindow.hide()

interface Code {
    title: string;
    code: string;
}

export default function Copy() {
    let permissionGranted: boolean
    const [snippetCode, setSnippedCode] = useState('');
    const [snippetName, setSnippetName] = useState('')

    const shortcuts = async () => {
        await register('CommandOrControl+Shift+C', async () => {
            if (await appWindow.isVisible()) {
                await appWindow.hide();
            } else {
                await invoke('copy_text');
                await fetchClipboardText();

                const mouseLocation: String = await invoke('get_mouse_location');
                const [xStr, yStr] = mouseLocation.substring(1, mouseLocation.length - 1).split(',');
                const x = parseInt(xStr.trim(), 10);
                const y = parseInt(yStr.trim(), 10);
                const physicalPosition = new PhysicalPosition(x, y)
                await appWindow.setPosition(physicalPosition)

                await appWindow.setSkipTaskbar(true);
                await appWindow.center();
                await appWindow.show();
                await appWindow.setFocus();

                await register('Esc', async () => {
                    if (await appWindow.isVisible()) {
                        await appWindow.hide()
                    }
                    await unregister('Esc');
                })
            }
        });

        await appWindow.onFocusChanged(async ({ payload: focused }) => {
            if (focused == false) {
                appWindow.hide();
                setSnippetName('');
                setSnippedCode('');
            }
            await unregister('Esc');
        });
    }

    async function fetchClipboardText() {
        try {
            let clipboardText: string | null;
            clipboardText = await readText();
            if (clipboardText !== null) {
                setSnippedCode(clipboardText);
            }
        } catch (error) {
            console.error('Erro ao ler da área de transferência:', error);
        }
    }

    const [codes, setCodes] = useState<Code[]>([])

    const fetchData = async () => {
        let fileFound = false;
        let attemptCount = 0;

        while (!fileFound && attemptCount < 30) {
            try {
                const data = await readTextFile('data.json', { dir: BaseDirectory.AppLocalData });
                const parsedData = JSON.parse(data);
                setCodes(parsedData);
                fileFound = true;
            } catch (error) {
                console.error('Erro ao buscar dados:', error);
                attemptCount++;
                await new Promise(resolve => setTimeout(resolve, 1000))
            }
        }

        if (!fileFound) {
            console.error('Arquivo não encontrado após 30 segundos.');
        }
    };

    const addNewCode = async () => {
        try {
            const newCode: Code = {
                title: snippetName,
                code: snippetCode
            };

            const currentCodes = [...codes, newCode];
            const dataString = JSON.stringify(currentCodes);
            await writeTextFile('data.json', dataString, { dir: BaseDirectory.AppLocalData });
            setCodes(prevCodes => [...prevCodes, newCode]);
            emit('json-data-added', {
                theMessage: 'Json has been updated',
            })

            if (!permissionGranted) {
                const permission = await requestPermission();
                permissionGranted = permission === 'granted';
            }

            if (permissionGranted) {
                sendNotification({ title: 'Success!', body: 'Your snippet has been saved successfully.', sound: 'default' });
            }

            appWindow.hide()
        } catch (error) {
            if (!permissionGranted) {
                const permission = await requestPermission();
                permissionGranted = permission === 'granted';
            }

            if (permissionGranted) {
                sendNotification({ title: 'Error!', body: `${error}`, sound: 'default' });
            }
        }
    };

    listen('json-data-deleted', async () => {
        await fetchData();
    })

    useEffect(() => {
        fetchClipboardText();
        fetchData();
        shortcuts();
    }, []);

    return (

        <div className="w-full h-full flex flex-col text-white gap-2
         rounded-3xl overflow-hidden p-4 text-center"
        >
            <h1 className="mb-2 text-xs select-none">PawCopy</h1>

            <Input
                type="text"
                className="border-0 border-b-2 rounded-none border-b-white/15 focus-visible:ring-0 shadow-none h-10"
                value={snippetName}
                placeholder="Snippet name"
                onChange={(event) => setSnippetName(event.target.value)}
                autoFocus
            />

            <ScrollArea className="max-h-[174px] h-full overflow-auto rounded-xl border border-white/15">
                <CodeEditor
                    value={snippetCode}
                    placeholder="Please enter your code."
                    className="w-full min-h-[135px] bg-[#2d2d2d6e]"
                    style={{
                        // backgroundColor: "",
                        fontFamily: 'ui-monospace,SFMono-Regular,SF Mono,Consolas,Liberation Mono,Menlo,monospace'
                    }}
                    onChange={(event) => setSnippedCode(event.target.value)}
                />
            </ScrollArea>

            <Button variant="outline"
                className="bg-transparent border border-white/15 hover:bg-[#2d2d2d6e]
                hover:text-white active:bg-white active:text-black"
                onClick={addNewCode}
            >
                Salvar
            </Button>
        </div>
    )
}