<topicKey helpcloseconfig/>
<topicBack id="topicNext" link="cluster"/>
<topicNext id="topicBack" link="ui"/>

<a style="float: right;" href="javascript:docNextTopic()">&nbsp;&nbsp;Next&nbsp;<i class="fa fa-lg fa-arrow-right"></i></a>
<a style="float: right;" href="javascript:docNextTopic('toc')">&nbsp;&nbsp;TOC&nbsp;&nbsp;</a>
<a style="float: right;" href="javascript:docPrevTopic()"><i class="fa fa-lg fa-arrow-left"></i>&nbsp;Prev&nbsp;&nbsp;</a>

### Help/Close/Config

In the upper right-hand corner of the UI there are three icons that provide:

- Help - context based help
- Close - shutdown and close VpK
- Configure - configure options for VpK

<p align="center">
  <img style="float: center;" src="docs/docimages/help_close_config.png" width="140">
</p>

<hr style="border:1px solid #aaaaaa">

### Help

VpK provides a build-in help system that is context aware based on the currently selected tab. Clicking the help button will open the help system. When selected the help system will present information related to the currently selected tab.  

If the VpK icon in the upper left-hand corner of the home screen is pressed the help Table of Contents is opened.  

All help topics provide three buttons in the upper right of the screen to aid in navigation.  These buttons are Prev (previous topic), TOC (table of contents), and Next (next topic).  

This built-in help system is a modified version of the web based VpK documentation.

The following is the Table of Contents page for the help system.

<p align="center">
  <img style="float: center;" src="docs/docimages/help_toc.png" width="1024">
</p>

<hr style="border:1px solid #aaaaaa">

### Shutdown

VpK can be stopped by selecting the "X" button in the upper right portion of the home screen.  Press the button and confirm the shutdown by pressing the "__Shutdown__" button.

<p align="center">
  <img style="float: center;" src="docs/docimages/ui_shutdown_confirm.png" width="1024">
</p>

!!! Info

    If VpK is running in a Docker container the container will be stopped at this time.

Once the shutdown and close process has completed the following screen is displayed.

<p align="center">
  <img style="float: center;" src="docs/docimages/ui_shutdown_complete.png" width="1024">
</p>

<hr style="border:1px solid #aaaaaa">

### Config

From the home screen click the gear in the upper right portion of the screen to open the VpK configuration.   

Several configuration options are available in this portion of VpK.  The configuration options aid in the ability to control what is displayed when the k8s resource is viewed, the background for the k8s resource view and the 3D cluster view, 
redacting information for k8s secret resources, how data is refreshed, saving the changes, and viewing of VpK resources for the server and browser components.  

The Config option can only be closed by pressing the __Close__ button.

---

Items that are configurable are:

- managedFields : this controls the displaying of __managedFields__ when a K8s resource information is displayed.  Enabling this 
option will show the managedFields.

- status : controls the displaying of the __status__ section when a K8s resource information is displayed.  Enabling this 
option will show the status information.

- Redact K8s Secret data : controls if the data section of a K8s Secret resource should be redacted. If enabled all items in the 
data section will be replaced with __Content has been REDACTED__.  

!!! Warning

    If this option is modified a complete reload of the selected Snapshot must be performed. The redacting or showing of the Secret data is performed when the Snapshot is processed.

- Snapshot reload : controls if a full reload and re-parse of a Snapshot is performed.  If a selected Snapshot has been processed and is selected to be processed a second time without loading another Snapshot the default is to perform a soft load of the Snapshot data. Enabling this option will force a complete reload of the selected Snapshot.   

- View resource theme : controls if a light or dark background is used when viewing the detail resource data in YAML format.


- 3D cluster background : controls the background that is shown in the Cluster tab 3D view.  Three options: Grey, Stars, and Sky are the available options.

- Save configuration : press this button to save the current configuration settings.

- View usage information - technical information regarding the server and browser are displayed.  See the Usage screen show below.

- Close : press this button to close the configuration screen.


#### Configuration screen

The following screen is what is shown when the Config option is selected.

<p align="center">
  <img style="float: center;" src="docs/docimages/config.png" width="1024">
</p>

If changes have been made in the configuration and the close button is pressed prior to saving the changed data a prompt is displayed to confirm the desire to not save the changes.  The following prompt message is displayed:

<p align="center">
  <img style="float: center;" src="docs/docimages/config_action.png">
</p>

---

If the 'Save configuration' button is pressed the following will be shown once the information is saved.

<p align="center">
  <img style="float: center;" src="docs/docimages/config_confirm.png">
</p>

<hr style="border:1px solid #aaaaaa">

#### Resource viewing themes

Two themes are available for viewing the k8s resource source and status information.  These are the light and dark.  Examples
for each follow:

#### Light theme

A white background is shown with this theme. Text is shown in purple, blue, and black.

<p align="center">
  <img style="float: center;" src="docs/docimages/resource_light.png">
</p>

#### Dark theme

A black background is shown with this theme. Text is shown in orange, green, and grey.

<p align="center">
  <img style="float: center;" src="docs/docimages/resource_dark.png">
</p>

<hr style="border:1px solid #aaaaaa">

#### VpK component usage information

Press the blue circle with an "i" located in the bottom portion of screen to view the VpK usage information.  This includes
memory, cpu, network, operating system, browser agent, and machine information.

<p align="center">
  <img style="float: center;" src="docs/docimages/about.png">
</p>

<hr style="border:1px solid #aaaaaa">
