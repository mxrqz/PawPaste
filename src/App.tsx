import { useState, useEffect, useRef } from "react";
import { invoke } from '@tauri-apps/api/tauri'
import { register, unregister } from '@tauri-apps/api/globalShortcut';
import { PhysicalPosition, appWindow } from "@tauri-apps/api/window";
import { writeText } from '@tauri-apps/api/clipboard';
import { Input } from "./components/ui/input";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass, faTrashCan } from '@fortawesome/free-solid-svg-icons'
import { Separator } from "./components/ui/separator";
import { writeTextFile, BaseDirectory, exists, readTextFile } from '@tauri-apps/api/fs';
import { ScrollArea } from "./components/ui/scroll-area";
import { emit, listen } from '@tauri-apps/api/event';
import { requestPermission, sendNotification } from '@tauri-apps/api/notification';

appWindow.hide()

interface Code {
  title: string;
  code: string;
}

export default function App() {
  let permissionGranted: boolean

  const dataExample = [
    {
      "title": "Exemplo de código em JavaScript",
      "code": "for (let i = 0; i < 10; i++) {\n  console.log(i);\n}"
    },
    {
      "title": "Exemplo de código em Python",
      "code": "def greet(name):\n    print('Hello, ' + name)\n\ngreet('World')"
    }
  ]

  const verifyExample = async () => {
    try {
      const fileExists = await exists('data.json', { dir: BaseDirectory.AppLocalData });
      if (!fileExists) {
        const dataString = JSON.stringify(dataExample);
        await writeTextFile('data.json', dataString, { dir: BaseDirectory.AppLocalData });
      }
    } catch (error) {
      console.error('Erro ao verificar a existência do arquivo:', error);
    }
  }

  const shortcuts = async () => {
    await register('CommandOrControl+Shift+V', async () => {
      if (await appWindow.isVisible()) {
        await appWindow.hide();
        await unregister('esc');
      } else {
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
        appWindow.hide()
      }
      await unregister('Esc');
    });
  }

  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const selectedItemRef = useRef<HTMLDivElement>(null);
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

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value);
    setSelectedIndex(0);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((prevIndex) => (prevIndex < filteredData.length - 1 ? prevIndex + 1 : prevIndex));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((prevIndex) => (prevIndex > 0 ? prevIndex - 1 : prevIndex));
    } else if (event.key === 'Enter' && selectedIndex !== -1) {
      const selectedCode = filteredData[selectedIndex]?.code;
      if (selectedCode !== undefined) {
        handleSelectedCode(selectedCode);
      }
    }
  };

  const handleItemClick = (index: number) => {
    setSelectedIndex(index);
    const selectedCode = filteredData[index]?.code
    if (selectedCode !== undefined) {
      handleSelectedCode(selectedCode)
    }
  };

  const handleSelectedCode = async (code: string) => {
    await writeText(code);
    await appWindow.hide();
    invoke('paste_text')
  }

  const filteredData = codes.filter((code) =>
    code.title.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    if (selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [selectedIndex]);

  const handleDelete = async (title: string) => {
    try {
      const updatedCodes = codes.filter(item => item.title !== title);

      const dataString = JSON.stringify(updatedCodes);
      await writeTextFile('data.json', dataString, { dir: BaseDirectory.AppLocalData });

      emit('json-data-deleted', {
        theMessage: 'Tauri is awesome!',
      })
      setCodes(updatedCodes)

      if (!permissionGranted) {
        const permission = await requestPermission();
        permissionGranted = permission === 'granted';
      }

      if (permissionGranted) {
        sendNotification({ title: 'Success!', body: 'Your snippet has been deleted successfully.', sound: 'default' });
      }
    } catch (error) {
      if (!permissionGranted) {
        const permission = await requestPermission();
        permissionGranted = permission === 'granted';
      }

      if (permissionGranted) {
        sendNotification({ title: 'Error!', body: `${error}`, sound: 'default' });
      }
    }
  }

  listen('json-data-added', async () => {
    await fetchData();
  })

  useEffect(() => {
    verifyExample();
    fetchData();
    shortcuts();
  }, []);

  return (
    <div className="w-full h-full flex flex-col justify-start text-white gap-2 p-4 text-center">
      <h1 className="mb-2 text-xs select-none">PawPaste</h1>

      <div className="flex items-center justify-center w-full">
        <FontAwesomeIcon icon={faMagnifyingGlass} />
        <Input
          type="text"
          className="focus-visible:ring-0 border-0 shadow-none"
          autoFocus
          value={search}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
        />
      </div>

      <Separator className="bg-[#f1f1f141]" />

      <ScrollArea className="w-full h-full overflow-x-hidden">
        <div className="w-full h-full overflow-hidden" style={{ userSelect: 'none' }}>

          {filteredData.map((item, index) => (
            <div
              key={index}
              ref={index === selectedIndex ? selectedItemRef : null}
              className={`cursor-default text-nowrap p-1 text-sm mt-1 rounded-md border border-transparent hover:bg-[#2d2d2d6e] hover:border hover:border-solid hover:border-white/15 
                w-full overflow-hidden text-ellipsis ${index === selectedIndex ? 'bg-[#2d2d2d6e] border border-white/15' : ''}
                flex justify-between items-center`}
              // onClick={() => handleItemClick(index)}
              onKeyDown={(event) => event.key === 'Enter' && handleItemClick(index)}
              tabIndex={0}
            >

              <span className="overflow-hidden text-ellipsis w-full text-left" onClick={() => handleItemClick(index)}>{item.title}</span>
              <FontAwesomeIcon icon={faTrashCan} onClick={() => handleDelete(item.title)} />
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>

  );
}