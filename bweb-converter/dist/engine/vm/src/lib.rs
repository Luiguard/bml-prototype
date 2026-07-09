use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct BdtVm {
    stack: Vec<i32>,
    memory: Vec<u8>,
    instruction_limit: u32,
    cycles: u32,
}

#[wasm_bindgen]
impl BdtVm {
    #[wasm_bindgen(constructor)]
    pub fn new(mem_size: usize, max_cycles: u32) -> BdtVm {
        BdtVm {
            stack: Vec::with_capacity(256),
            memory: vec![0; mem_size],
            instruction_limit: max_cycles,
            cycles: 0,
        }
    }

    pub fn execute_event(&mut self, node_id: u32, event_type: &str) -> i32 {
        // Diese Methode wird direkt von render.js (Canvas Event Delegation) aufgerufen
        // Gibt > 0 zurück, wenn ein Reflow / Re-Paint erforderlich ist (State changed)
        
        self.cycles = 0; // Reset für neue Ausführung
        
        // Simulierter Event-Handler: Wenn Button (Node) geklickt wird
        if event_type == "click" {
            // Im echten System würde hier der BDT-Bytecode des Nodes geladen und ausgeführt
            // Wir simulieren eine State-Änderung:
            return 1; // Signalisiert: "State hat sich geändert, bitte Reflow & Repaint"
        }
        
        0 // Keine Änderung
    }

    pub fn execute(&mut self, bytecode: &[u8]) -> Result<i32, JsValue> {
        self.cycles = 0;
        let mut pc = 0;
        
        while pc < bytecode.len() {
            if self.cycles >= self.instruction_limit {
                return Err(JsValue::from_str("Execution Timeout: Cycle limit exceeded"));
            }
            self.cycles += 1;
            
            let opcode = bytecode[pc];
            pc += 1;
            
            match opcode {
                0x00 => break, // HALT
                0x01 => {      // PUSH_CONST (1 byte)
                    if pc >= bytecode.len() { return Err(JsValue::from_str("EOF in PUSH_CONST")); }
                    self.stack.push(bytecode[pc] as i32);
                    pc += 1;
                }
                0x02 => {      // ADD
                    let b = self.stack.pop().unwrap_or(0);
                    let a = self.stack.pop().unwrap_or(0);
                    self.stack.push(a + b);
                }
                0x03 => {      // SUB
                    let b = self.stack.pop().unwrap_or(0);
                    let a = self.stack.pop().unwrap_or(0);
                    self.stack.push(a - b);
                }
                0x04 => {      // EQ
                    let b = self.stack.pop().unwrap_or(0);
                    let a = self.stack.pop().unwrap_or(0);
                    self.stack.push(if a == b { 1 } else { 0 });
                }
                // Weitere Opcodes für DOM-Interaktion via Callbacks oder Shared Memory...
                _ => return Err(JsValue::from_str("Unknown Opcode")),
            }
        }
        
        Ok(self.stack.pop().unwrap_or(0))
    }
}
