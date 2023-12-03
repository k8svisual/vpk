<topicKey ui/>
<topicBack id="topicNext" link="helpcloseconfig"/>
<topicNext id="topicBack" link="snapshots"/>

<a style="float: right;" href="javascript:docNextTopic()">&nbsp;&nbsp;Next&nbsp;<i class="fas fa-lg fa-arrow-right"></i></a>
<a style="float: right;" href="javascript:docNextTopic('toc')">&nbsp;&nbsp;TOC&nbsp;&nbsp;</a>
<a style="float: right;" href="javascript:docPrevTopic()"><i class="fas fa-lg fa-arrow-left"></i>&nbsp;Prev&nbsp;&nbsp;</a>

### User Interface

The User Interface (UI), browser component is comprised of a top section and a series of tabs. The tabs provide graphical views of the cluster; deployed workloads; graphs (hierarchy, collapible hierarchy, and circle pack); storage requests with sizes and hierarchy; security; search; and owner references hierarchy.

### Screen Interactions

Interaction with the user interface provides the ability to drill down to obtain additional information.  These interactions include:

- From the 3D Cluster view click on any of the items in the view.
- If you see an icon, click on it. 
- If you see a blue or red circle in a hierarchy diagram, click on it.
- If you see a blue circle in a circle pack diagram, click on it.
- From the Security and OwnerRef Links click on any color shaped object.


### Splash screen

When the application is started a splash screen is shown.  This modal is shown for approximately three seconds and then closed.
If the refresh option for the browser is selected the splash screen will be redisplayed. 

<p align="center">
  <img style="float: center;" src="docs/docimages/ui_startup.png" width="1024">
</p>

<hr style="border:1px solid #aaaaaa">

### Top section of screen

The top of the screen provides the ability to create or select a snapshot, open help, configuration, and shutdown/close the application.

<p align="center">
  <img style="float: center;" src="docs/docimages/ui_top2.png" width="1024">
</p>

<hr style="border:1px solid #aaaaaa">

### Snapshots 

All data to be used by VpK is stored in a snapshot. The snapshot drop down field is how to get started in creating or selecting a snapshot.  For detail snapshot information refer to the "__SNAPSHOTS__" category in this documentation site.


<hr style="border:1px solid #aaaaaa">

### Tabs

Information for each of the tabs is included in the "__UI TABS__" category of this documentation.  Each tab is listed along with descriptions and instructions on usage.   

A summary of the tabs follows;

- Cluster - This is a high-level 3D view of the cluster. The view is interactive and can be rotated, tilted, zoomed in or out, and filtered.
- Workload Schematics - This is a schematic view of a deployed Pod and the associated resources. 
- Storage - Storage provides a view of the defined StorageClasses, Persistent Volumes, and Persistent Volume Claims along with the amount of space requested for each. The lower portion of the screen provides statistics for defined storage for a selected Volume Type, Node, or Namespace.
- Security - Security provides a view of the defined role, subject, and bindings for resources in the cluster level or selected namespace.
- OwnerRef - OwnerRef Links provides a view of the owner reference chain for resources in the selected namespace.
- Event Msgs - A table view of all Event messages that were available in the K8s cluster when the Snapshot was created. 
- Container Images - Container Images provides two views, table and graph, of the container images defined within the K8s cluster by Repository.
- Search - Search provides the ability to search all K8s resources in the selected snapshot.

If any tab is selected and no Snapshot has been selected a warning message is display.  

<p align="center">
  <img style="float: center;" src="docs/docimages/ui_no_data.png" width="300">
</p>


<hr style="border:1px solid #aaaaaa">

### Server console

When VpK is started the server portion will display a startup banner and be followed with log messages.

<p align="center">
  <img style="float: center;" src="docs/docimages/splash_vpk_2.png" width="800">
</p>


Log messages provide information regarding VpK processing of the selected Snaphsot.  Summary statistics for selected items
are displayed when a Snapshot has been processed.


<p align="center">
  <img style="float: center;" src="docs/docimages/splash_log.png" width="800">
</p>

<hr style="border:1px solid #aaaaaa">