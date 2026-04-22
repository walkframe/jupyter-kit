import { test, expect } from '@playwright/test';

test('test katex', async ({ page }) => {
  await page.goto('http://localhost:6006/iframe.html?id=test--katex&viewMode=story');
  await page.waitForLoadState('networkidle');
  
  const cells = await page.locator('.cell').all();
  expect(cells).toHaveLength(9);

  {
    expect(await cells[0].locator('.input_prompt').textContent()).toContain('In [1]:');
    expect(await cells[0].locator('pre').textContent()).toContain('import matplotlib.pyplot as plt');
    expect(await cells[0].locator('.output_area').innerHTML()).toContain('<img alt="output png" src="data:image/png;base64,iVBORw0');
  }

  {
    expect(await cells[1].locator('.input_prompt').textContent()).toContain('In [5]:');
    expect(await cells[1].locator('pre').textContent()).toContain('A = sy.Matrix([[2, 8], [1, 0]])');

    const output = cells[1].locator('.output_area').first();
    const katex = output.locator('.katex').first();
    expect(await katex.innerHTML()).toContain('<span class="mord">2</span>');
    expect(await katex.innerHTML()).toContain('<span class="mord">8</span>');
    expect(await katex.innerHTML()).toContain('<span class="mord">1</span>');
    expect(await katex.innerHTML()).toContain('<span class="mord">0</span>');
    expect(await katex.innerHTML()).toContain('<span class="delimsizing size3">[</span>');
    expect(await katex.innerHTML()).toContain('<span class="delimsizing size3">]</span>');
  }

  {
    expect(await cells[2].locator('.input_prompt').textContent()).toContain('In [6]:');
    expect(await cells[2].locator('pre').textContent()).toContain('A ** (n-1) * sy.Matrix([3, 1])');
    //expect(await cells[2].locator('.output_area').innerHTML()).toContain('<svg xmlns="http://www.w3.org/2000/svg" width="20.183ex" height="7.908ex" role="img"');
  }

  {
    expect(await cells[3].locator('.input_prompt').textContent()).toContain('In [7]:');
    expect(await cells[3].locator('pre').textContent()).toContain('display(df)');
    const tables = await cells[3].locator('.output_area').locator('table').all();
    expect(tables).toHaveLength(1);
    const table = tables[0];
    expect(await table.locator('tr').count()).toBe(6);
  }

  {
    expect(await cells[4].locator('.input_prompt').textContent()).toContain('In [9]:');
    expect(await cells[4].locator('.language-python').textContent()).toContain('this is a syntax error');

    const output = cells[4].locator('.output_subarea').first();
    expect(output).toHaveClass(/output_error/);
    expect(output).toHaveCSS('background-color', 'rgba(255, 0, 0, 0.25)');
    //expect(output.locator('span').filter({hasText: 'File'}).first()).toHaveCSS('color', 'rgb(0, 187, 187)');
    //expect(output.locator('span').filter({hasText: '<ipython-input-9-4d9d942c1a8e>'}).first()).toHaveCSS('color', 'rgb(0, 187, 0)');
  }
  
  {
    expect(await cells[5].locator('.input_prompt').textContent()).toContain('In [10]:');
    expect(await cells[5].locator('pre').textContent()).toContain('from IPython.display import Latex');
    expect(await cells[5].locator('.output_area').textContent()).toContain('The mass-energy equivalence is described by the famous equation');
    
    const katex = cells[5].locator('.output_area').locator('.katex-html').first();
    const html = await katex.innerHTML();
    // E = mc^2
    expect(html).toContain('<span class="mord mathnormal" style="margin-right:0.05764em;">E</span>');
    expect(html).toContain('<span class="mspace" style="margin-right:0.2778em;"></span>');
    expect(html).toContain('<span class="mrel">=</span>');
    expect(html).toContain('<span class="mord mathnormal">m</span>');
    expect(html).toContain('<span class="mord mathnormal">c</span>');
    expect(html).toContain('<span class="mord mtight">2</span>');

    expect(await cells[5].locator('.output_area').textContent()).toContain('discovered in 1905 by Albert Einstein.');
    // c
    //expect(await cells[5].locator('.output_area').innerHTML()).toContain('<svg xmlns="http://www.w3.org/2000/svg" width="0.98ex" height="1.025ex" role="img"');
    expect(await cells[5].locator('.output_area').textContent()).toContain('the formula expresses the identity');
    // E = m
    //expect(await cells[5].locator('.output_area').innerHTML()).toContain('<svg xmlns="http://www.w3.org/2000/svg" width="6.732ex" height="1.724ex" role="img"');
  }

  {
    // Markdown
    expect(await cells[6].locator('.input_prompt').textContent()).not.toContain('In');
    const output = cells[6].locator('.rendered_html').first();
    const header = output.locator('h1').first();
    expect(header).toHaveText('Markdown Cell');

    //expect(await output.innerHTML()).toContain('<svg xmlns="http://www.w3.org/2000/svg" width="23.457ex" height="2.388ex" role="img"');
    expect(await output.innerHTML()).toContain('<p><em>It</em> <strong>really</strong> is!!</p>');
  }

  {
    expect(await cells[7].locator('.input_prompt').textContent()).toContain('In [11]:');
    expect(await cells[7].locator('.language-python').textContent()).toContain("sys.stdout.write('hello world\\n')");
    const outputs = await cells[7].locator('.output_area').all();
    expect(outputs).toHaveLength(3);
    expect(outputs[0].locator('.output_subarea').first()).toHaveClass(/output-stdout/);
    expect(outputs[1].locator('.output_subarea').first()).toHaveClass(/output-stderr/);
    //expect(outputs[2].locator('.output_subarea').first()).toHaveClass(/output-stdout/);
  }

  {
    // markdown
    expect(await cells[8].locator('.input_prompt').textContent()).not.toContain('In');
    const output = cells[8].locator('.rendered_html').first();
    expect(await output.innerHTML()).toContain('<img src="https://github.com/walkframe/jupyter-kit/raw/master/images/logo.png" alt="logo.png">');
  }

});
